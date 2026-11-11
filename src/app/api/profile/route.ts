import { sql } from "drizzle-orm";
import { db } from "@/db";
import { json } from "@/server/util";

export const dynamic = "force-dynamic";

/** Public player profile (for player visits / friend lookups). Contains no private data. */
export async function GET(req: Request) {
  const code = (new URL(req.url).searchParams.get("code") ?? "").toUpperCase().slice(0, 10);
  if (!code) return json({ error: "code required" }, 400);
  const r = await db.execute(sql`
    select p.name, p.code, p.created_at as "joined",
      (select count(*)::int from expeditions e where e.player_id = p.id) as expeditions,
      (select coalesce(max(e.max_depth),0)::int from expeditions e where e.player_id = p.id) as "bestDepth",
      (select coalesce(max(e.score),0)::int from expeditions e where e.player_id = p.id) as "bestScore",
      (select count(*)::int from discoveries d where d.player_id = p.id) as discoveries,
      (select count(*)::int from discoveries d where d.player_id = p.id and d.is_first) as firsts
    from players p where p.code = ${code}`);
  if (!r.rows[0]) return json({ error: "not found" }, 404);
  return json({ profile: r.rows[0] });
}
