import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { partyMembers, parties, players } from "@/db/schema";
import { authPlayer, json, makeCode, rateLimit } from "@/server/util";
import { randomInt } from "node:crypto";

export const dynamic = "force-dynamic";

async function stateFor(playerId: string) {
  const mine = await db.select({ pid: parties.id }).from(partyMembers).innerJoin(parties, eq(parties.id, partyMembers.partyId))
    .where(and(eq(partyMembers.playerId, playerId), ne(parties.status, "closed"))).limit(1);
  if (!mine[0]) return null;
  const [party] = await db.select().from(parties).where(eq(parties.id, mine[0].pid)).limit(1);
  const members = await db.select({ id: players.id, name: players.name, lastSeen: partyMembers.lastSeen }).from(partyMembers)
    .innerJoin(players, eq(players.id, partyMembers.playerId)).where(eq(partyMembers.partyId, party.id));
  const now = Date.now();
  return {
    id: party.id, code: party.code, hostId: party.hostId, seed: party.seed, biome: party.biome, status: party.status, me: playerId,
    members: members.map((m) => ({ id: m.id, name: m.name, host: m.id === party.hostId, online: now - m.lastSeen.getTime() < 12_000 || m.id === playerId })),
  };
}

export async function GET(req: Request) {
  const me = await authPlayer(req);
  if (!me) return json({ error: "unauthorized" }, 401);
  const s = await stateFor(me.id);
  if (s) await db.update(partyMembers).set({ lastSeen: new Date() }).where(and(eq(partyMembers.partyId, s.id), eq(partyMembers.playerId, me.id)));
  return json({ party: s });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), biome: z.number().int().min(0).max(4) }),
  z.object({ action: z.literal("join"), code: z.string().trim().min(3).max(8) }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("start") }),
]);

async function leave(playerId: string) {
  const s = await stateFor(playerId);
  if (!s) return;
  await db.delete(partyMembers).where(and(eq(partyMembers.partyId, s.id), eq(partyMembers.playerId, playerId)));
  const rest = s.members.filter((m) => m.id !== playerId);
  if (!rest.length) await db.update(parties).set({ status: "closed" }).where(eq(parties.id, s.id));
  else if (s.hostId === playerId) await db.update(parties).set({ hostId: rest[0].id }).where(eq(parties.id, s.id));
}

export async function POST(req: Request) {
  const me = await authPlayer(req);
  if (!me) return json({ error: "unauthorized" }, 401);
  if (!rateLimit("party:" + me.id, 40, 60_000)) return json({ error: "rate limited" }, 429);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return json({ error: "invalid" }, 400);
  const a = b.data;
  if (a.action === "create") {
    await leave(me.id);
    const [p] = await db.insert(parties).values({ code: makeCode(5), hostId: me.id, seed: randomInt(1, 2 ** 31), biome: a.biome }).returning();
    await db.insert(partyMembers).values({ partyId: p.id, playerId: me.id });
  } else if (a.action === "join") {
    const [p] = await db.select().from(parties).where(eq(parties.code, a.code.toUpperCase())).limit(1);
    if (!p || p.status === "closed") return json({ error: "Parti bulunamadı" }, 404);
    const cur = await db.select().from(partyMembers).where(eq(partyMembers.partyId, p.id));
    const already = cur.some((m) => m.playerId === me.id);
    if (!already) {
      if (cur.length >= 4) return json({ error: "Parti dolu (en fazla 4 oyuncu)" }, 409);
      if (p.status === "active") return json({ error: "Sefer zaten başladı" }, 409);
      await leave(me.id);
      await db.insert(partyMembers).values({ partyId: p.id, playerId: me.id });
    } else await db.update(partyMembers).set({ lastSeen: new Date() }).where(and(eq(partyMembers.partyId, p.id), eq(partyMembers.playerId, me.id)));
  } else if (a.action === "leave") {
    await leave(me.id);
  } else {
    const s = await stateFor(me.id);
    if (!s) return json({ error: "Parti yok" }, 404);
    if (s.hostId !== me.id) return json({ error: "Sadece kurucu başlatabilir" }, 403);
    await db.update(parties).set({ status: "active" }).where(eq(parties.id, s.id));
  }
  return json({ party: await stateFor(me.id) });
}
