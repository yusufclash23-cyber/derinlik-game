import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { friends, players } from "@/db/schema";
import { authPlayer, json, rateLimit } from "@/server/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await authPlayer(req);
  if (!me) return json({ error: "unauthorized" }, 401);
  const r = await db.execute(sql`
    select f.id, f.status, f.player_id as "playerId", p.id as "otherId", p.name, p.code
    from friends f join players p on p.id = (case when f.player_id = ${me.id} then f.friend_id else f.player_id end)
    where f.player_id = ${me.id} or f.friend_id = ${me.id}`);
  const rows = r.rows as { id: number; status: string; playerId: string; otherId: string; name: string; code: string }[];
  return json({
    friends: rows.filter((x) => x.status === "accepted").map((x) => ({ id: x.otherId, name: x.name, code: x.code })),
    incoming: rows.filter((x) => x.status === "pending" && x.playerId !== me.id).map((x) => ({ id: x.id, name: x.name, code: x.code })),
    outgoing: rows.filter((x) => x.status === "pending" && x.playerId === me.id).map((x) => ({ id: x.id, name: x.name, code: x.code })),
  });
}

const Body = z.union([z.object({ code: z.string().trim().min(4).max(10) }), z.object({ acceptId: z.number().int() })]);

export async function POST(req: Request) {
  const me = await authPlayer(req);
  if (!me) return json({ error: "unauthorized" }, 401);
  if (!rateLimit("fr:" + me.id, 20, 60_000)) return json({ error: "rate limited" }, 429);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return json({ error: "invalid" }, 400);
  if ("acceptId" in b.data) {
    const u = await db.update(friends).set({ status: "accepted" }).where(and(eq(friends.id, b.data.acceptId), eq(friends.friendId, me.id), eq(friends.status, "pending"))).returning({ id: friends.id });
    return u.length ? json({ ok: true }) : json({ error: "not found" }, 404);
  }
  const [other] = await db.select().from(players).where(eq(players.code, b.data.code.toUpperCase())).limit(1);
  if (!other) return json({ error: "Oyuncu bulunamadı" }, 404);
  if (other.id === me.id) return json({ error: "Kendini ekleyemezsin" }, 400);
  const ex = await db.select().from(friends).where(or(and(eq(friends.playerId, me.id), eq(friends.friendId, other.id)), and(eq(friends.playerId, other.id), eq(friends.friendId, me.id))));
  const rev = ex.find((x) => x.playerId === other.id);
  if (rev && rev.status === "pending") { await db.update(friends).set({ status: "accepted" }).where(eq(friends.id, rev.id)); return json({ ok: true, accepted: true }); }
  if (ex.length) return json({ error: "Zaten arkadaş veya istek bekliyor" }, 409);
  await db.insert(friends).values({ playerId: me.id, friendId: other.id, status: "pending" });
  return json({ ok: true });
}
