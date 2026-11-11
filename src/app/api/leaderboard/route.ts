import { sql } from "drizzle-orm";
import { db } from "@/db";
import { weekKey } from "@/game/economy";
import { json } from "@/server/util";

export const dynamic = "force-dynamic";

/** Depth Race ranking. scope=weekly (default) | alltime. Score is computed server-side from validated data only. */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") === "alltime" ? "alltime" : "weekly";
  const week = weekKey(Date.now());
  try {
    const r = await db.execute(sql`
      select p.name, p.code, max(e.score)::int as score, max(e.max_depth)::int as depth, max(e.value)::int as value, max(e.created_at) as at
      from expeditions e join players p on p.id = e.player_id
      where ${scope === "alltime"} or e.week = ${week}
      group by p.id order by score desc limit 25`);
    return json({ scope, week, rows: r.rows });
  } catch (e) {
    console.error(e);
    return json({ scope, week, rows: [], error: "db" }, 500);
  }
}
