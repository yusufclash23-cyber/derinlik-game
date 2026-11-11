/**
 * Save schema + every validated economy transaction.
 * All functions are PURE: they clone the save and return a new one (or an error),
 * so they can be unit-tested and re-used on a server.
 */
import {
  BASE, BIOMES, BUILDINGS, GEAR_BY_ID, MAX_KEYS, MISSIONS, MISSION_BY_ID, RESOURCES, SMELT, TECHS, TOOL_BY_ID,
  rarityIdx, type BuildingId, type Cost, type GearDef, type MissionDef, type ResourceId, type Reward, type Slot, type ToolDef,
} from "./config";
import { hash2 } from "./gen";

export interface DiscoveryRecord {
  id: string; res: ResourceId; depth: number; t: number; biome: number; seed: number;
  server: "pending" | "first" | "recorded" | "rejected";
}
export interface HistoryEntry { id: string; ts: number; biome: number; outcome: string; maxDepth: number; value: number; duration: number }
export interface ExpeditionReport {
  id: string; seed: number; biome: number; outcome: "extracted" | "died"; durationSec: number; maxDepth: number;
  minedIds: number[]; kills: number; bossKill: boolean; hidden: number; discoveries: { key: string; depth: number }[];
}
export interface Period { key: string; counts: Record<string, number>; claimed: string[] }
export interface Settings { music: number; sfx: number; quality: "auto" | "low" | "medium" | "high"; lang: "tr" | "en" }
export interface Save {
  v: 1; name: string; revision: number; createdAt: number; lastSeen: number; coins: number; xp: number;
  stash: Record<string, number>; buildings: Record<BuildingId, number>;
  tools: string[]; toolEquipped: string; gear: string[]; equipped: Record<Slot, string>; suit: string;
  techs: string[]; consumables: { medkit: number; oxygenCan: number }; titles: string[]; title: string;
  collection: Record<string, { first: number; count: number }>; discoveries: DiscoveryRecord[];
  lostPack: { biome: number; res: Record<string, number>; frac: number } | null;
  activeRun: { id: string; startedAt: number; biome: number; seed: number; carry: { medkit: number; oxygenCan: number } } | null;
  life: Record<string, number>; daily: Period; weekly: Period; claimedAch: string[];
  history: HistoryEntry[]; pendingReports: ExpeditionReport[]; settings: Settings; tutorialDone: boolean;
}

export type Result<T = object> = ({ ok: true; save: Save } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
export const weekKey = (now: number) => "W" + Math.floor((now / 86400000 + 3) / 7);

export function newSave(name = "Kâşif", now = Date.now()): Save {
  const buildings = {} as Record<BuildingId, number>;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) buildings[id] = BUILDINGS[id].initial;
  return {
    v: 1, name, revision: 0, createdAt: now, lastSeen: now, coins: BASE.startCoins, xp: 0, stash: {}, buildings,
    tools: ["pick_basic"], toolEquipped: "pick_basic",
    gear: ["helmet0", "armor0", "backpack0", "gloves0", "boots0", "lantern0"],
    equipped: { helmet: "helmet0", armor: "armor0", backpack: "backpack0", gloves: "gloves0", boots: "boots0", lantern: "lantern0" },
    suit: "orange", techs: [], consumables: { medkit: 1, oxygenCan: 1 }, titles: [], title: "",
    collection: {}, discoveries: [], lostPack: null, activeRun: null, life: {},
    daily: { key: dayKey(now), counts: {}, claimed: [] }, weekly: { key: weekKey(now), counts: {}, claimed: [] }, claimedAch: [],
    history: [], pendingReports: [], tutorialDone: false,
    settings: { music: 0.6, sfx: 0.8, quality: "auto", lang: "tr" },
  };
}

/** Defensive loader: fills missing fields so old/corrupt saves never crash the game. */
export function normalizeSave(raw: unknown, now = Date.now()): Save {
  const base = newSave("Kâşif", now);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Save>;
  const s: Save = { ...base, ...r } as Save;
  s.buildings = { ...base.buildings, ...(r.buildings ?? {}) };
  s.equipped = { ...base.equipped, ...(r.equipped ?? {}) };
  s.settings = { ...base.settings, ...(r.settings ?? {}) };
  s.consumables = { ...base.consumables, ...(r.consumables ?? {}) };
  s.daily = r.daily ?? base.daily; s.weekly = r.weekly ?? base.weekly;
  for (const k of Object.keys(s.stash)) { const n = Math.floor(Number(s.stash[k])); if (!(n > 0) || !(k in RESOURCES)) delete s.stash[k]; else s.stash[k] = n; }
  s.coins = Math.max(0, Math.floor(Number(s.coins) || 0));
  s.xp = Math.max(0, Math.floor(Number(s.xp) || 0));
  if (!s.tools.includes(s.toolEquipped)) s.toolEquipped = "pick_basic";
  return s;
}

export const levelOf = (xp: number) => 1 + Math.floor(Math.sqrt(xp / 60));
export const xpForLevel = (lvl: number) => (lvl - 1) * (lvl - 1) * 60;

/* ------------------------------ stats ------------------------------ */
export interface PlayerStats {
  maxHp: number; maxOxygen: number; maxEnergy: number; speed: number; capacity: number; light: number;
  armor: number; heat: number; tool: ToolDef; power: number; speedMult: number; hazardMult: number;
  recoverFrac: number; scan: number; medkitHeal: number; attack: number;
}
export function computeStats(save: Save): PlayerStats {
  const sum = (k: keyof NonNullable<GearDef["stats"]>) =>
    (Object.values(save.equipped) as string[]).reduce((a, id) => a + (GEAR_BY_ID[id]?.stats[k] ?? 0), 0);
  const tool = TOOL_BY_ID[save.toolEquipped] ?? TOOL_BY_ID.pick_basic;
  const has = (t: string) => save.techs.includes(t);
  const med = save.buildings.medical;
  const oxyMult = 1 + (has("oxy1") ? 0.1 : 0) + (has("oxy2") ? 0.1 : 0);
  return {
    maxHp: BASE.hp + sum("hp") + med * 10,
    maxOxygen: Math.round((BASE.oxygen + sum("oxygen")) * oxyMult),
    maxEnergy: BASE.energy + sum("energy") + (has("energy1") ? 20 : 0),
    speed: BASE.speed * (1 + sum("speed")),
    capacity: BASE.capacity + sum("capacity"),
    light: BASE.light + sum("light"),
    armor: sum("armor"), heat: Math.min(0.85, sum("heat")), tool,
    power: 1 + sum("power"), speedMult: 1 + sum("miningSpeed"),
    hazardMult: has("hazard1") ? 0.75 : 1,
    recoverFrac: Math.min(0.85, BASE.recoverBase + (has("recover1") ? 0.15 : 0) + (has("recover2") ? 0.15 : 0)),
    scan: has("scan2") ? 50 : has("scan1") ? 25 : 0,
    medkitHeal: 30 + med * 12 + 10,
    attack: BASE.attack + tool.power * 0.5,
  };
}

export const backpackWeight = (bp: Record<string, number>) =>
  Object.entries(bp).reduce((a, [k, n]) => a + (RESOURCES[k as ResourceId]?.weight ?? 0) * n, 0);
export const resourceValue = (bp: Record<string, number>) =>
  Object.entries(bp).reduce((a, [k, n]) => a + (RESOURCES[k as ResourceId]?.value ?? 0) * n, 0);
export const stashCap = (s: Save) => 100 * s.buildings.warehouse;
export const unlockedBiomes = (s: Save) => Math.min(BIOMES.length, s.buildings.elevator);

/* ------------------------------ helpers ------------------------------ */
export function canAfford(s: Save, c: Cost): boolean {
  if (s.coins < c.coins) return false;
  for (const [k, n] of Object.entries(c.res ?? {})) if ((s.stash[k] ?? 0) < (n ?? 0)) return false;
  return true;
}
function pay(s: Save, c: Cost) {
  s.coins -= c.coins;
  for (const [k, n] of Object.entries(c.res ?? {})) {
    s.stash[k] = (s.stash[k] ?? 0) - (n ?? 0);
    if (s.stash[k] <= 0) delete s.stash[k];
  }
}
/** Adds to the stash respecting warehouse cap; overflow is auto-sold at 60%. Returns coins gained from overflow. */
export function addToStash(s: Save, res: ResourceId, n: number): number {
  n = Math.floor(n);
  if (!(n > 0) || !(res in RESOURCES)) return 0;
  const cap = stashCap(s);
  const cur = s.stash[res] ?? 0;
  const add = Math.max(0, Math.min(n, cap - cur));
  if (add > 0) s.stash[res] = cur + add;
  const over = n - add;
  const coins = Math.floor(over * RESOURCES[res].value * 0.6);
  s.coins += coins;
  return coins;
}
export function bump(s: Save, key: string, n: number, now = Date.now()) {
  rollPeriods(s, now);
  const max = MAX_KEYS.has(key);
  for (const c of [s.life, s.daily.counts, s.weekly.counts]) c[key] = max ? Math.max(c[key] ?? 0, n) : (c[key] ?? 0) + n;
}
export function rollPeriods(s: Save, now: number) {
  if (s.daily.key !== dayKey(now)) s.daily = { key: dayKey(now), counts: {}, claimed: [] };
  if (s.weekly.key !== weekKey(now)) s.weekly = { key: weekKey(now), counts: {}, claimed: [] };
}

/* ------------------------------ market ------------------------------ */
export function marketMult(s: Save, _now?: number) {
  return (1 + 0.05 * (s.buildings.trading - 1)) * (1 + (s.techs.includes("sell1") ? 0.05 : 0));
}
export function dailyFluct(res: ResourceId, now: number) {
  const day = Math.floor(now / 86400000);
  const i = Object.keys(RESOURCES).indexOf(res);
  return 0.92 + 0.16 * ((hash2(day, i + 11) % 1000) / 1000);
}
export const marketPrice = (s: Save, res: ResourceId, now: number) =>
  Math.max(1, Math.floor(RESOURCES[res].value * marketMult(s, now) * dailyFluct(res, now)));

export function sell(s0: Save, res: ResourceId, n: number, now = Date.now()): Result<{ gained: number }> {
  if (!(res in RESOURCES)) return fail("Bilinmeyen kaynak");
  if (!Number.isInteger(n) || n <= 0) return fail("Geçersiz miktar");
  if ((s0.stash[res] ?? 0) < n) return fail("Depoda yeterli kaynak yok");
  const s = clone(s0);
  const gained = marketPrice(s, res, now) * n;
  s.stash[res] -= n;
  if (s.stash[res] <= 0) delete s.stash[res];
  s.coins += gained;
  return { ok: true, save: s, gained };
}
export function sellAll(s0: Save, now = Date.now()): Result<{ gained: number }> {
  let s = s0, total = 0;
  for (const [k, n] of Object.entries(s0.stash)) {
    const r = sell(s, k as ResourceId, n, now);
    if (r.ok) { s = r.save; total += r.gained; }
  }
  return total > 0 ? { ok: true, save: s, gained: total } : fail("Satılacak kaynak yok");
}

/* ------------------------------ camp ------------------------------ */
export function nextBuildingCost(s: Save, id: BuildingId): Cost | null {
  const def = BUILDINGS[id];
  const lvl = s.buildings[id];
  return lvl >= def.levels.length ? null : def.levels[lvl];
}
export function upgradeBuilding(s0: Save, id: BuildingId): Result<{ level: number }> {
  const def = BUILDINGS[id];
  if (!def) return fail("Bilinmeyen bina");
  const lvl = s0.buildings[id];
  if (lvl >= def.levels.length) return fail("Maksimum seviye");
  const next = lvl + 1;
  if (id !== "hq" && next - 1 > s0.buildings.hq) return fail(`Karargâh seviye ${next - 1} gerekli`);
  const cost = def.levels[lvl];
  if (!canAfford(s0, cost)) return fail("Yetersiz kaynak veya altın");
  const s = clone(s0);
  pay(s, cost);
  s.buildings[id] = next;
  return { ok: true, save: s, level: next };
}
export function smelt(s0: Save, recipeId: string, times: number): Result<{ made: number }> {
  const rec = SMELT.find((r) => r.id === recipeId);
  if (!rec) return fail("Bilinmeyen tarif");
  if (s0.buildings.furnace < 1) return fail("Önce Eritme Ocağı inşa et");
  if (!Number.isInteger(times) || times <= 0) return fail("Geçersiz miktar");
  if ((s0.stash[rec.input] ?? 0) < rec.need * times || (s0.stash.coal ?? 0) < rec.coal * times) return fail("Yetersiz cevher veya kömür");
  const s = clone(s0);
  s.stash[rec.input] -= rec.need * times;
  s.stash.coal -= rec.coal * times;
  for (const k of [rec.input, "coal"]) if (s.stash[k] <= 0) delete s.stash[k];
  const made = times + Math.floor(times * 0.15 * (s.buildings.furnace - 1));
  addToStash(s, rec.out, made);
  return { ok: true, save: s, made };
}
export function craftGear(s0: Save, id: string): Result {
  const g = GEAR_BY_ID[id];
  if (!g) return fail("Bilinmeyen ekipman");
  if (s0.gear.includes(id)) return fail("Zaten sahipsin");
  if (g.tier > s0.buildings.workshop) return fail(`Atölye seviye ${g.tier} gerekli`);
  if (!canAfford(s0, g.cost)) return fail("Yetersiz kaynak veya altın");
  const s = clone(s0);
  pay(s, g.cost);
  s.gear.push(id);
  s.equipped[g.slot] = id;
  return { ok: true, save: s };
}
export function equipGear(s0: Save, id: string): Result {
  const g = GEAR_BY_ID[id];
  if (!g || !s0.gear.includes(id)) return fail("Bu ekipmana sahip değilsin");
  const s = clone(s0);
  s.equipped[g.slot] = id;
  return { ok: true, save: s };
}
export function craftTool(s0: Save, id: string, now = Date.now()): Result {
  const t = TOOL_BY_ID[id];
  if (!t) return fail("Bilinmeyen alet");
  if (s0.tools.includes(id)) return fail("Zaten sahipsin");
  if (t.level > s0.buildings.workshop) return fail(`Atölye seviye ${t.level} gerekli`);
  if (!canAfford(s0, t.cost)) return fail("Yetersiz kaynak veya altın");
  const s = clone(s0);
  pay(s, t.cost);
  s.tools.push(id);
  s.toolEquipped = id;
  bump(s, "craft:" + id, 1, now);
  return { ok: true, save: s };
}
export function equipTool(s0: Save, id: string): Result {
  if (!s0.tools.includes(id)) return fail("Bu alete sahip değilsin");
  const s = clone(s0);
  s.toolEquipped = id;
  return { ok: true, save: s };
}
export function research(s0: Save, id: string): Result {
  const t = TECHS.find((x) => x.id === id);
  if (!t) return fail("Bilinmeyen teknoloji");
  if (s0.techs.includes(id)) return fail("Zaten araştırıldı");
  if (s0.buildings.lab < t.lab) return fail(`Laboratuvar seviye ${t.lab} gerekli`);
  if (t.requires && !s0.techs.includes(t.requires)) return fail("Önkoşul teknoloji eksik");
  if (!canAfford(s0, t.cost)) return fail("Yetersiz kaynak veya altın");
  const s = clone(s0);
  pay(s, t.cost);
  s.techs.push(id);
  return { ok: true, save: s };
}
export function buyConsumable(s0: Save, kind: "medkit" | "oxygenCan", n = 1): Result {
  if (s0.buildings.medical < 1) return fail("Önce Sağlık İstasyonu inşa et");
  if (!Number.isInteger(n) || n <= 0) return fail("Geçersiz miktar");
  if (s0.consumables[kind] + n > 9) return fail("En fazla 9 adet taşınabilir");
  const cost = (kind === "medkit" ? BASE.medkitCost : BASE.oxygenCost) * n;
  if (s0.coins < cost) return fail("Yetersiz altın");
  const s = clone(s0);
  s.coins -= cost;
  s.consumables[kind] += n;
  return { ok: true, save: s };
}
export function setSuit(s0: Save, id: string): Result {
  const s = clone(s0); s.suit = id; return { ok: true, save: s };
}
export function setTitle(s0: Save, title: string): Result {
  if (title && !s0.titles.includes(title)) return fail("Bu unvana sahip değilsin");
  const s = clone(s0); s.title = title; return { ok: true, save: s };
}

/* ------------------------------ missions ------------------------------ */
function pickBy(pool: MissionDef[], key: string, n: number): MissionDef[] {
  return pool
    .map((m, i) => ({ m, h: hash2(Array.from(key).reduce((a, c) => a + c.charCodeAt(0), 0), i * 17 + 3) }))
    .sort((a, b) => a.h - b.h).slice(0, n).map((x) => x.m);
}
export const dailyMissions = (now: number) => pickBy(MISSIONS.filter((m) => m.kind === "daily"), dayKey(now), 3);
export const weeklyMissions = (now: number) => pickBy(MISSIONS.filter((m) => m.kind === "weekly"), weekKey(now), 3);
export function missionProgress(s: Save, m: MissionDef): number {
  if (m.key === "distinct") return Object.keys(s.collection).length;
  const src = m.kind === "daily" ? s.daily.counts : m.kind === "weekly" ? s.weekly.counts : s.life;
  return Math.min(m.target, src[m.key] ?? 0);
}
export const missionClaimed = (s: Save, m: MissionDef) =>
  m.kind === "daily" ? s.daily.claimed.includes(m.id) : m.kind === "weekly" ? s.weekly.claimed.includes(m.id) : s.claimedAch.includes(m.id);
export function claimMission(s0: Save, id: string, now = Date.now()): Result<{ reward: Reward }> {
  const m = MISSION_BY_ID[id];
  if (!m) return fail("Bilinmeyen görev");
  const s = clone(s0);
  rollPeriods(s, now);
  const active = m.kind === "ach" || (m.kind === "daily" ? dailyMissions(now) : weeklyMissions(now)).some((x) => x.id === id);
  if (!active) return fail("Bu görev şu an aktif değil");
  if (missionClaimed(s, m)) return fail("Ödül zaten alındı");
  if (missionProgress(s, m) < m.target) return fail("Görev henüz tamamlanmadı");
  (m.kind === "daily" ? s.daily.claimed : m.kind === "weekly" ? s.weekly.claimed : s.claimedAch).push(id);
  applyReward(s, m.reward);
  return { ok: true, save: s, reward: m.reward };
}
function applyReward(s: Save, r: Reward) {
  s.coins += r.coins ?? 0;
  s.xp += r.xp ?? 0;
  for (const [k, n] of Object.entries(r.res ?? {})) addToStash(s, k as ResourceId, n ?? 0);
  if (r.title && !s.titles.includes(r.title)) s.titles.push(r.title);
}

/* ------------------------------ expeditions ------------------------------ */
export function startRun(s0: Save, biome: number, seed: number, id: string, now = Date.now()): Result<{ carry: { medkit: number; oxygenCan: number } }> {
  if (s0.activeRun) return fail("Zaten aktif bir sefer var");
  if (!Number.isInteger(biome) || biome < 0 || biome >= unlockedBiomes(s0)) return fail("Bu bölge henüz kilitli");
  const s = clone(s0);
  const carry = { medkit: Math.min(BASE.carryMedkit, s.consumables.medkit), oxygenCan: Math.min(BASE.carryOxygen, s.consumables.oxygenCan) };
  s.consumables.medkit -= carry.medkit;
  s.consumables.oxygenCan -= carry.oxygenCan;
  s.activeRun = { id, startedAt: now, biome, seed: seed >>> 0, carry };
  return { ok: true, save: s, carry };
}

export interface RunResult {
  id: string; seed: number; biome: number; outcome: "extracted" | "died"; durationSec: number;
  backpack: Record<string, number>; coins: number; xp: number; counters: Record<string, number>;
  maxDepth: number; hidden: number; boss: boolean; kills: number; minedIds: number[];
  discoveries: { res: ResourceId; depth: number; t: number }[];
  carryLeft: { medkit: number; oxygenCan: number }; lostPackTaken: boolean; deathDepthFrac: number;
}
export interface RunSummary { kept: Record<string, number>; lost: Record<string, number>; destroyed: number; coins: number; xp: number; value: number; levelUp: boolean }

export function finishRun(s0: Save, r: RunResult, now = Date.now()): Result<{ summary: RunSummary }> {
  if (!s0.activeRun || s0.activeRun.id !== r.id) return fail("Bu sefer zaten sonuçlandırıldı"); // duplicate-reward guard
  const s = clone(s0);
  rollPeriods(s, now);
  const bp: Record<string, number> = {};
  for (const [k, n] of Object.entries(r.backpack)) {
    const v = Math.floor(n);
    if (k in RESOURCES && v > 0) bp[k] = v;
  }
  const lvlBefore = levelOf(s.xp);
  if (r.lostPackTaken) s.lostPack = null; // recovered into the backpack; at risk again
  const kept: Record<string, number> = {}, lost: Record<string, number> = {};
  let destroyed = 0, coins = Math.max(0, Math.floor(r.coins));
  const value = resourceValue(bp);
  if (r.outcome === "extracted") {
    for (const [k, n] of Object.entries(bp)) { addToStash(s, k as ResourceId, n); kept[k] = n; }
    s.coins += coins;
  } else {
    const st = computeStats(s);
    const pack: Record<string, number> = {};
    for (const [k, n] of Object.entries(bp)) {
      const keep = Math.floor(n * BASE.recoverKeep);
      const rest = n - keep;
      const rec = Math.floor(rest * st.recoverFrac);
      if (keep > 0) { addToStash(s, k as ResourceId, keep); kept[k] = keep; }
      if (rec > 0) { pack[k] = rec; lost[k] = rec; }
      destroyed += rest - rec;
    }
    coins = Math.floor(coins * BASE.recoverKeep);
    s.coins += coins;
    if (Object.keys(pack).length) {
      if (s.lostPack && s.lostPack.biome === r.biome) for (const [k, n] of Object.entries(s.lostPack.res)) pack[k] = (pack[k] ?? 0) + n;
      s.lostPack = { biome: r.biome, res: pack, frac: Math.max(0.05, Math.min(0.95, r.deathDepthFrac)) };
    }
  }
  s.consumables.medkit = Math.min(9, s.consumables.medkit + Math.max(0, r.carryLeft.medkit | 0));
  s.consumables.oxygenCan = Math.min(9, s.consumables.oxygenCan + Math.max(0, r.carryLeft.oxygenCan | 0));
  // stats / collection
  for (const [k, n] of Object.entries(r.counters)) {
    bump(s, k, Math.max(0, Math.floor(n)), now);
    if (k.startsWith("mine:") && k !== "mine:any") {
      const res = k.slice(5);
      if (res in RESOURCES) {
        const c = s.collection[res] ?? { first: now, count: 0 };
        c.count += n; s.collection[res] = c;
      }
    }
  }
  bump(s, "depth", Math.floor(r.maxDepth), now);
  if (r.hidden) bump(s, "hidden", r.hidden, now);
  if (r.boss) bump(s, "boss", 1, now);
  if (r.outcome === "extracted") { bump(s, "extract", 1, now); bump(s, "value", value, now); bump(s, "valueBest", value, now); }
  else bump(s, "deaths", 1, now);
  for (const d of r.discoveries) {
    if (!s.collection[d.res]) s.collection[d.res] = { first: now, count: 0 };
    if (rarityIdx(RESOURCES[d.res].rarity) >= 4) bump(s, "legendary", 1, now);
    if (rarityIdx(RESOURCES[d.res].rarity) >= 2 && !s.discoveries.some((x) => x.res === d.res && x.id.startsWith(r.id))) {
      s.discoveries.unshift({ id: `${r.id}:${d.res}`, res: d.res, depth: d.depth, t: now, biome: r.biome, seed: r.seed, server: "pending" });
    }
  }
  s.discoveries = s.discoveries.slice(0, 60);
  s.xp += Math.max(0, Math.floor(r.xp));
  s.history.unshift({ id: r.id, ts: now, biome: r.biome, outcome: r.outcome, maxDepth: Math.floor(r.maxDepth), value, duration: Math.floor(r.durationSec) });
  s.history = s.history.slice(0, 20);
  s.pendingReports.push({
    id: r.id, seed: r.seed, biome: r.biome, outcome: r.outcome, durationSec: Math.floor(r.durationSec), maxDepth: Math.floor(r.maxDepth),
    minedIds: r.minedIds.slice(0, 400), kills: r.kills, bossKill: r.boss, hidden: r.hidden,
    discoveries: s.discoveries.filter((d) => d.id.startsWith(r.id)).map((d) => ({ key: d.res, depth: d.depth })),
  });
  s.pendingReports = s.pendingReports.slice(-20);
  s.activeRun = null;
  return { ok: true, save: s, summary: { kept, lost, destroyed, coins, xp: r.xp, value, levelUp: levelOf(s.xp) > lvlBefore } };
}

/** Called on load. Abandoned runs (app closed mid-expedition) forfeit their loot — closing the app is never an escape hatch. */
export function applyOffline(s0: Save, now = Date.now()): { save: Save; income: number; abandoned: boolean } {
  const s = clone(s0);
  let abandoned = false, income = 0;
  if (s.activeRun) {
    abandoned = true;
    s.history.unshift({ id: s.activeRun.id, ts: now, biome: s.activeRun.biome, outcome: "abandoned", maxDepth: 0, value: 0, duration: 0 });
    s.activeRun = null;
  }
  const dt = now - s.lastSeen;
  if (dt > 60_000 && dt < 30 * 86400_000) {
    income = Math.floor(Math.min(dt / 3600_000, 8) * 15 * s.buildings.hq);
    s.coins += income;
  }
  s.lastSeen = now; // moves forward only; clock rollback never grants income
  rollPeriods(s, now);
  return { save: s, income, abandoned };
}
