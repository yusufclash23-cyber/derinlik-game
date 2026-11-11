import { sql } from "drizzle-orm";
import { db } from "@/db";
import { weekKey } from "@/game/economy";
import { authPlayer, json } from "@/server/util";

export const dynamic = "force-dynamic";

/** Global / weekly / personal discovery records. `isFirst` comes from the authoritative DB only. */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "global";
  const me = scope === "mine" ? await authPlayer(req) : null;
  if (scope === "mine" && !me) return json({ rows: [], error: "unauthorized" }, 401);
  const week = weekKey(Date.now());
  const filter = scope === "mine" && me ? sql`d.player_id = ${me.id}` : scope === "weekly" ? sql`d.week = ${week}` : sql`true`;
  try {
    const r = await db.execute(sql`
      select d.id, p.name, d.key, d.depth, d.is_first as "isFirst", d.created_at as at
      from discoveries d join players p on p.id = d.player_id
      where ${filter} order by d.is_first desc, d.created_at desc limit 40`);
    return json({ scope, rows: r.rows });
  } catch (e) {
    console.error(e);
    return json({ rows: [], error: "db" }, 500);
  }
}
