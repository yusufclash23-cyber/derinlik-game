import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { partyMembers } from "@/db/schema";
import { MAX_RUN_SPEED } from "@/game/config";
import { authPlayer, json, rateLimit } from "@/server/util";

export const dynamic = "force-dynamic";

interface Pos { x: number; z: number; f: number; a: string; hp: number; name: string; t: number }
type G = typeof globalThis & { __dParty?: Map<string, { pos: Map<string, Pos>; member: Map<string, number>; seen: Map<string, number> }> };
const store = () => ((globalThis as G).__dParty ??= new Map());

const Body = z.object({ partyId: z.string().uuid(), x: z.number().min(-10), z: z.number().min(-10), f: z.number(), a: z.enum(["idle", "walk", "mine", "attack", "dead"]), hp: z.number().min(0).max(5000) });

/**
 * Co-op presence sync (HTTP polling adapter, ~4 Hz). Server validates membership and rejects teleporting.
 * Last-seen timestamps give disconnect handling; the same endpoint transparently serves reconnection.
 * A WebSocket service can replace this endpoint without touching game code (see README).
 */
export async function POST(req: Request) {
  const me = await authPlayer(req);
  if (!me) return json({ error: "unauthorized" }, 401);
  if (!rateLimit("sync:" + me.id, 600, 60_000)) return json({ error: "rate limited" }, 429);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return json({ error: "invalid" }, 400);
  const s = b.data;
  const st = store();
  let room = st.get(s.partyId);
  if (!room) { room = { pos: new Map(), member: new Map(), seen: new Map() }; st.set(s.partyId, room); }
  const now = Date.now();
  if (now - (room.member.get(me.id) ?? 0) > 30_000) {
    const m = await db.select().from(partyMembers).where(and(eq(partyMembers.partyId, s.partyId), eq(partyMembers.playerId, me.id))).limit(1);
    if (!m[0]) return json({ error: "not a member" }, 403);
    room.member.set(me.id, now);
  }
  const prev = room.pos.get(me.id);
  let { x, z } = s;
  let corrected = false;
  if (prev) {
    const dt = Math.max(0.05, (now - prev.t) / 1000);
    if (Math.hypot(x - prev.x, z - prev.z) > MAX_RUN_SPEED * dt + 4) { x = prev.x; z = prev.z; corrected = true; } // speed-hack guard
  }
  room.pos.set(me.id, { x, z, f: s.f, a: s.a, hp: s.hp, name: me.name, t: now });
  if (now - (room.seen.get(me.id) ?? 0) > 3000) {
    room.seen.set(me.id, now);
    await db.update(partyMembers).set({ lastSeen: new Date() }).where(and(eq(partyMembers.partyId, s.partyId), eq(partyMembers.playerId, me.id)));
  }
  const players = [...room.pos.entries()].filter(([id, p]) => id !== me.id && now - p.t < 10_000).map(([id, p]) => ({ id, name: p.name, x: p.x, z: p.z, f: p.f, a: p.a, hp: p.hp }));
  return json({ players, corrected });
}
