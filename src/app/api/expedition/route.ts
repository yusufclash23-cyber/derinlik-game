import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { discoveries, expeditions } from "@/db/schema";
import { weekKey } from "@/game/economy";
import { validateReport } from "@/game/validate";
import { authPlayer, json, rateLimit } from "@/server/util";

export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().min(8).max(64),
  seed: z.number().int().min(0).max(4294967295),
  biome: z.number().int().min(0).max(4),
  outcome: z.enum(["extracted", "died"]),
  durationSec: z.number().min(0).max(10800),
  maxDepth: z.number().min(0).max(10000),
  minedIds: z.array(z.number().int().min(0).max(5000)).max(400),
  kills: z.number().int().min(0).max(500),
  bossKill: z.boolean(),
  hidden: z.number().int().min(0).max(10),
  discoveries: z.array(z.object({ key: z.string().max(40), depth: z.number().min(0).max(10000) })).max(20),
});

/**
 * Server-authoritative expedition result. The server re-generates the mine from the seed and rejects
 * anything physically impossible (see game/validate.ts). Score + discovery "first" flags are computed here only.
 */
export async function POST(req: Request) {
  const p = await authPlayer(req);
  if (!p) return json({ ok: false, error: "unauthorized" }, 401);
  if (!rateLimit("exp:" + p.id, 20, 60_000)) return json({ ok: false, error: "rate limited" }, 429);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ ok: false, error: "invalid report" }, 400);
  const r = body.data;

  const existing = await db.select().from(expeditions).where(eq(expeditions.id, r.id)).limit(1);
  if (existing[0]) {
    if (existing[0].playerId !== p.id) return json({ ok: false, error: "conflict" }, 409);
    const d = await db.select().from(discoveries).where(eq(discoveries.expeditionId, r.id));
    return json({ ok: true, duplicate: true, score: existing[0].score, discoveries: d.map((x) => ({ key: x.key, isFirst: x.isFirst })) });
  }

  const v = validateReport(r);
  if (!v.ok) return json({ ok: false, error: v.error }, 422);

  const week = weekKey(Date.now());
  const out = await db.transaction(async (tx) => {
    await tx.insert(expeditions).values({
      id: r.id, playerId: p.id, seed: r.seed, biome: r.biome, outcome: r.outcome, maxDepth: Math.floor(r.maxDepth), value: v.value, rare: v.rare,
      hidden: r.hidden, bossKill: r.bossKill, durationSec: Math.floor(r.durationSec), score: v.score, week,
    });
    const res: { key: string; isFirst: boolean }[] = [];
    for (const d of v.discoveries) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${d.key}))`); // serialises concurrent "first" claims per resource
      const first = await tx.execute(sql`select 1 from discoveries where key = ${d.key} and is_first = true limit 1`);
      const isFirst = first.rows.length === 0;
      await tx.insert(discoveries).values({ playerId: p.id, expeditionId: r.id, key: d.key, depth: Math.floor(d.depth), isFirst, week });
      res.push({ key: d.key, isFirst });
    }
    return res;
  }).catch((e: unknown) => { console.error("expedition tx failed", e); return null; });
  if (!out) return json({ ok: false, error: "could not record" }, 500);
  return json({ ok: true, score: v.score, discoveries: out });
}
