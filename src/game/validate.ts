/**
 * Server-side validation of expedition reports (anti-cheat).
 * The server regenerates the mine from (seed, biome) and checks that every claim is
 * physically/economically possible. Score is computed ONLY from validated data.
 */
import { MAX_RUN_SPEED, RESOURCES, rarityIdx, type ResourceId } from "./config";
import { TH, TILE, depthAt, generateMine } from "./gen";
import type { ExpeditionReport } from "./economy";

export type Validation =
  | { ok: true; value: number; rare: number; score: number; discoveries: { key: string; depth: number }[] }
  | { ok: false; error: string };

export function validateReport(r: ExpeditionReport): Validation {
  if (!Number.isInteger(r.biome) || r.biome < 0 || r.biome > 4) return { ok: false, error: "bad biome" };
  if (!(r.durationSec >= 0) || r.durationSec > 3 * 3600) return { ok: false, error: "bad duration" };
  if (r.outcome === "extracted" && r.durationSec < 2) return { ok: false, error: "too fast" };
  const mine = generateMine(r.seed, r.biome);
  const seen = new Set<number>();
  let value = 0, minTime = 0, maxDist = 0, deepest = 0, rare = 0;
  const resKinds = new Set<ResourceId>();
  for (const id of r.minedIds) {
    if (seen.has(id)) return { ok: false, error: "duplicate deposit" };
    seen.add(id);
    const d = mine.deposits[id];
    if (!d || d.kind !== "ore" || !d.res) return { ok: false, error: "unknown deposit" };
    const def = RESOURCES[d.res];
    value += d.qty * def.value;
    resKinds.add(d.res);
    if (rarityIdx(def.rarity) >= 2) rare += 1;
    minTime += d.durability / (55 * 1.5 * 3.2 * 1.2); // best possible tool+gear
    maxDist = Math.max(maxDist, Math.hypot(d.x - mine.start.x, d.z - mine.start.z));
    deepest = Math.max(deepest, depthAt(r.biome, d.z));
  }
  if (minTime > r.durationSec + 1) return { ok: false, error: "mining too fast" };
  if (maxDist / MAX_RUN_SPEED > r.durationSec + 1) return { ok: false, error: "movement too fast" };
  const maxPossible = depthAt(r.biome, TH * TILE);
  if (r.maxDepth < 0 || r.maxDepth > maxPossible) return { ok: false, error: "impossible depth" };
  if (r.maxDepth + 60 < deepest) return { ok: false, error: "inconsistent depth" };
  const startZ = mine.start.z;
  if (((depthAt(r.biome, 0) === r.maxDepth ? 0 : (r.maxDepth - depthAt(r.biome, 0)) / (maxPossible - depthAt(r.biome, 0))) * TH * TILE - startZ) / MAX_RUN_SPEED > r.durationSec + 1) {
    return { ok: false, error: "descent too fast" };
  }
  if (r.kills < 0 || r.kills > mine.spawns.length) return { ok: false, error: "bad kills" };
  if (r.hidden < 0 || r.hidden > mine.hiddenRooms.length) return { ok: false, error: "bad hidden count" };
  if (r.bossKill && r.kills < 1) return { ok: false, error: "boss without kills" };
  const discoveries: { key: string; depth: number }[] = [];
  for (const d of r.discoveries) {
    const def = RESOURCES[d.key as ResourceId];
    if (!def || rarityIdx(def.rarity) < 2) continue;
    // must come from a mined deposit OR the boss reward pool
    if (!resKinds.has(def.id) && !r.bossKill) return { ok: false, error: "discovery not mined" };
    discoveries.push({ key: def.id, depth: Math.min(d.depth, r.maxDepth + 1) });
  }
  const extracted = r.outcome === "extracted";
  const score = Math.round(
    r.maxDepth + value * 0.5 + rare * 500 + r.hidden * 300 + (extracted ? 1000 : 0) + (r.bossKill ? 1500 : 0) + (extracted ? Math.max(0, 600 - r.durationSec) : 0),
  );
  return { ok: true, value, rare, score, discoveries };
}
