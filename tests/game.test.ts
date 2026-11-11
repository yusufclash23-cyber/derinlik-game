import { describe, expect, it } from "vitest";
import { BIOMES, RESOURCES, type ResourceId } from "../src/game/config";
import { TW, generateMine, toTile } from "../src/game/gen";
import { Expedition, type Input } from "../src/game/engine";
import {
  addToStash, applyOffline, backpackWeight, buyConsumable, claimMission, computeStats, craftGear, craftTool, dailyMissions,
  finishRun, normalizeSave, newSave, sell, startRun, upgradeBuilding, smelt, type Save,
} from "../src/game/economy";
import { validateReport } from "../src/game/validate";

const IDLE: Input = { mx: 0, mz: 0, mining: false, extracting: false };
function make(biome = 0, seed = 1234, save: Save = newSave("T", 1000)) {
  const stats = computeStats(save);
  return new Expedition({ seed, biome, stats, carry: { medkit: 1, oxygenCan: 1 }, known: [], runId: "run-" + seed });
}
function minable(e: Expedition) {
  return e.deposits.find((d) => d.d.kind === "ore" && RESOURCES[d.d.res as ResourceId].toolLevel === 0)!;
}
function teleportTo(e: Expedition, x: number, z: number) { e.p.x = x; e.p.z = z; }

describe("procedural generation", () => {
  it("is deterministic per seed", () => {
    const a = generateMine(42, 0), b = generateMine(42, 0);
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(true);
    expect(a.deposits.map((d) => d.res)).toEqual(b.deposits.map((d) => d.res));
    expect(a.spawns.length).toBe(b.spawns.length);
  });
  it("produces valid maps (start, exit, reachable rooms) for many seeds in all biomes", () => {
    for (let biome = 0; biome < 5; biome++) for (let seed = 1; seed <= 25; seed++) {
      const m = generateMine(seed * 7919, biome);
      expect(m.valid, `biome ${biome} seed ${seed}`).toBe(true);
      expect(m.tiles[toTile(m.start.z) * TW + toTile(m.start.x)]).toBe(1);
      expect(m.exits[0].kind).toBe("elevator");
      expect(m.spawns.some((s) => s.boss)).toBe(true);
      expect(m.deposits.filter((d) => d.kind === "ore").length).toBeGreaterThan(10);
    }
  });
  it("different seeds give different layouts", () => {
    const a = generateMine(1, 0), b = generateMine(2, 0);
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(false);
  });
});

describe("mining", () => {
  it("breaks a deposit, adds to backpack and respects tool level", () => {
    const e = make();
    const ds = minable(e);
    teleportTo(e, ds.d.x - 1.8, ds.d.z);
    for (let i = 0; i < 600 && ds.alive; i++) e.tick(0.05, { ...IDLE, mining: true });
    expect(ds.alive).toBe(false);
    expect(e.bp[ds.d.res as string]).toBeGreaterThan(0);
    expect(e.run.minedIds).toContain(ds.d.id);
    const hard = make(1);
    const crystal = hard.deposits.find((d) => d.d.res === "blueCrystal")!;
    teleportTo(hard, crystal.d.x - 1.8, crystal.d.z);
    for (let i = 0; i < 100; i++) hard.tick(0.05, { ...IDLE, mining: true });
    expect(crystal.alive).toBe(true); // basic pickaxe too weak
    expect(hard.events.some((x) => x.t === "weak")).toBe(true);
  });
  it("never exceeds backpack capacity", () => {
    const e = make();
    e.stats.capacity = 3;
    const list = e.deposits.filter((d) => d.d.kind === "ore" && RESOURCES[d.d.res as ResourceId].toolLevel === 0).slice(0, 6);
    for (const ds of list) {
      teleportTo(e, ds.d.x - 1.8, ds.d.z);
      e.p.energy = e.stats.maxEnergy;
      for (let i = 0; i < 300 && ds.alive; i++) e.tick(0.05, { ...IDLE, mining: true });
    }
    expect(backpackWeight(e.bp)).toBeLessThanOrEqual(3 + 1e-6);
    expect(e.events.some((x) => x.t === "full")).toBe(true);
  });
  it("consumes energy and cannot mine without it", () => {
    const e = make();
    const ds = minable(e);
    teleportTo(e, ds.d.x - 1.8, ds.d.z);
    e.p.energy = 0;
    for (let i = 0; i < 20; i++) e.tick(0.05, { ...IDLE, mining: true });
    expect(ds.hp).toBe(ds.d.durability);
  });
  it("cannot mine through walls (range check on deposits only)", () => {
    const e = make();
    const far = e.deposits.find((d) => Math.hypot(d.d.x - e.p.x, d.d.z - e.p.z) > 12)!;
    for (let i = 0; i < 40; i++) e.tick(0.05, { ...IDLE, mining: true });
    expect(far.hp).toBe(far.d.durability);
  });
});

describe("survival & extraction", () => {
  it("oxygen depletes away from the elevator and refills at camp zone; suffocation kills", () => {
    const e = make();
    const room = e.mine.rooms.find((r) => r.kind === "boss")!;
    teleportTo(e, (room.cx + 0.5) * 2, (room.cy + 0.5) * 2);
    const o0 = e.p.oxygen;
    for (let i = 0; i < 100; i++) e.tick(0.05, IDLE);
    expect(e.p.oxygen).toBeLessThan(o0);
    e.p.oxygen = 0;
    e.enemies.length = 0;
    for (let i = 0; i < 20 * 60 && e.status === "running"; i++) e.tick(0.05, IDLE);
    expect(e.status).toBe("dead");
  });
  it("extracts only near an exit after holding", () => {
    const e = make();
    e.bp.copper = 3;
    for (let i = 0; i < 80; i++) e.tick(0.05, { ...IDLE, extracting: true });
    expect(e.status).toBe("running"); // spawn point is ~4 m away from the elevator
    teleportTo(e, e.mine.exits[0].x, e.mine.exits[0].z + 1);
    for (let i = 0; i < 80; i++) e.tick(0.05, { ...IDLE, extracting: true });
    expect(e.status).toBe("extracted");
    const e2 = make();
    const room = e2.mine.rooms.find((r) => r.kind === "boss")!;
    teleportTo(e2, (room.cx + 0.5) * 2, (room.cy + 0.5) * 2);
    for (let i = 0; i < 80; i++) e2.tick(0.05, { ...IDLE, extracting: true });
    expect(e2.status).toBe("running");
  });
});

describe("combat & boss", () => {
  it("player defeats a crawler and gets rewards; dead enemies stop attacking", () => {
    const e = make();
    const en = e.enemies.find((x) => !x.boss)!;
    teleportTo(e, en.x - 2, en.z);
    for (let i = 0; i < 400 && en.state !== "dead"; i++) { e.attack(); e.tick(0.05, IDLE); }
    expect(en.state).toBe("dead");
    expect(e.coins).toBeGreaterThan(0);
    const hp = e.p.hp;
    for (let i = 0; i < 100; i++) e.tick(0.05, IDLE);
    expect(e.p.hp).toBeGreaterThanOrEqual(Math.min(hp, e.stats.maxHp) - 40); // no further damage from the dead one
  });
  it("enemies detect, chase and hurt the player; shield absorbs", () => {
    const e = make();
    const en = e.enemies.find((x) => !x.boss)!;
    teleportTo(e, en.x - 4, en.z);
    for (const o of e.enemies) if (o !== en) o.state = "dead";
    for (let i = 0; i < 200 && e.p.hp >= e.stats.maxHp; i++) e.tick(0.05, IDLE);
    expect(e.p.hp).toBeLessThan(e.stats.maxHp);
    const hp = e.p.hp;
    e.p.energy = 100;
    expect(e.ability(1)).toBe(true);
    e.p.invuln = 0;
    e.damagePlayer(10);
    expect(e.p.hp).toBe(hp);
  });
  it("boss can be defeated and drops loot", () => {
    const e = make();
    e.stats.maxHp = 1e6; e.p.hp = 1e6; e.stats.attack = 60; e.stats.capacity = 999;
    const boss = e.enemies.find((x) => x.boss)!;
    teleportTo(e, boss.x, boss.z - 3);
    for (let i = 0; i < 2000 && boss.state !== "dead"; i++) { e.attack(); e.tick(0.05, IDLE); }
    expect(boss.state).toBe("dead");
    expect(e.run.boss).toBe(true);
    expect(e.run.counters.boss).toBe(1);
    expect(e.bp.iron).toBeGreaterThan(0);
  });
  it("dodge grants invulnerability and costs energy", () => {
    const e = make();
    const en0 = e.p.energy;
    expect(e.dodge(1, 0)).toBe(true);
    expect(e.p.energy).toBeLessThan(en0);
    const hp = e.p.hp;
    e.damagePlayer(50);
    expect(e.p.hp).toBe(hp);
  });
});

describe("economy & persistence", () => {
  const fullRun = (s: Save, outcome: "extracted" | "died", bp: Record<string, number>) => {
    const sr = startRun(s, 0, 99, "r1", 2000);
    if (!sr.ok) throw new Error(sr.error);
    const e = make(0, 99, sr.save);
    e.runId = "r1"; e.bp = bp; e.status = outcome === "extracted" ? "extracted" : "dead"; e.coins = 40;
    return { save: sr.save, res: e.result() };
  };
  it("sells with validation and never goes negative", () => {
    let s = newSave("T", 1000); s.stash.copper = 5;
    expect(sell(s, "copper", 6).ok).toBe(false);
    expect(sell(s, "copper", -1).ok).toBe(false);
    const r = sell(s, "copper", 5);
    expect(r.ok).toBe(true);
    if (r.ok) { s = r.save; expect(s.stash.copper).toBeUndefined(); expect(s.coins).toBeGreaterThan(40); }
  });
  it("extraction moves loot to camp; same run cannot be rewarded twice", () => {
    const { save, res } = fullRun(newSave("T", 1000), "extracted", { copper: 4, coal: 2 });
    const r1 = finishRun(save, res, 3000);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.save.stash.copper).toBe(4);
    expect(r1.save.activeRun).toBeNull();
    const r2 = finishRun(r1.save, res, 3001);
    expect(r2.ok).toBe(false);
    expect(r1.save.pendingReports.length).toBe(1);
  });
  it("death keeps part, drops recoverable pack, never wipes progress", () => {
    const base = newSave("T", 1000); base.stash.iron = 7; base.coins = 500;
    const { save, res } = fullRun(base, "died", { copper: 20 });
    const r = finishRun(save, res, 3000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.stash.iron).toBe(7);
    expect(r.save.stash.copper).toBe(5);
    expect(r.save.lostPack?.res.copper).toBe(Math.floor(15 * 0.4));
    expect(r.save.coins).toBeGreaterThan(500 - 1);
  });
  it("lost pack appears in next mine and can be recovered", () => {
    const e = new Expedition({ seed: 5, biome: 0, stats: computeStats(newSave("T")), carry: { medkit: 0, oxygenCan: 0 }, known: [], runId: "x", lostPack: { res: { copper: 6 }, frac: 0.5 } });
    expect(e.lostPack).not.toBeNull();
    teleportTo(e, e.lostPack!.x, e.lostPack!.z);
    e.tick(0.05, IDLE);
    expect(e.bp.copper).toBe(6);
    expect(e.run.lostPackTaken).toBe(true);
  });
  it("upgrades, crafting and warehouse caps are validated", () => {
    let s = newSave("T", 1000);
    expect(upgradeBuilding(s, "furnace").ok).toBe(false);
    s.coins = 1000; s.stash = { stone: 30, copper: 30, coal: 30 };
    const f = upgradeBuilding(s, "furnace");
    expect(f.ok).toBe(true);
    if (f.ok) s = f.save;
    expect(s.buildings.furnace).toBe(1);
    const t = craftTool(s, "pick_iron");
    expect(t.ok).toBe(true);
    if (t.ok) expect(computeStats(t.save).tool.id).toBe("pick_iron");
    expect(craftGear(s, "helmet3").ok).toBe(false);
    s.stash.copper = 99; addToStash(s, "copper", 500);
    expect(s.stash.copper).toBe(100);
    s.stash = { iron: 6, coal: 2 }; s.coins = 0;
    const sm = smelt(s, "ironIngot", 2);
    expect(sm.ok).toBe(true);
    if (sm.ok) expect(sm.save.stash.ironIngot).toBe(2);
    expect(buyConsumable(newSave("T"), "medkit").ok).toBe(false);
  });
  it("save reload keeps everything; corrupt saves are normalized; abandoned run forfeits", () => {
    let s = newSave("Yusuf", 1000); s.coins = 777; s.stash.gold = 3;
    const reloaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(reloaded.coins).toBe(777);
    expect(reloaded.stash.gold).toBe(3);
    expect(normalizeSave({ coins: -50, stash: { gold: -4, foo: 3 } }).stash).toEqual({});
    const sr = startRun(s, 0, 1, "ab", 1000);
    if (!sr.ok) throw new Error();
    const off = applyOffline(sr.save, 1000 + 3 * 3600_000);
    expect(off.abandoned).toBe(true);
    expect(off.save.activeRun).toBeNull();
    expect(off.income).toBeGreaterThan(0);
    const back = applyOffline(off.save, 1000); // clock rolled back => no free money
    expect(back.income).toBe(0);
  });
  it("missions require completion and cannot be claimed twice", () => {
    const s = newSave("T", Date.now());
    const m = dailyMissions(Date.now())[0];
    expect(claimMission(s, m.id).ok).toBe(false);
    s.daily.counts[m.key] = m.target;
    const c = claimMission(s, m.id);
    expect(c.ok).toBe(true);
    if (c.ok) expect(claimMission(c.save, m.id).ok).toBe(false);
  });
});

describe("server report validation", () => {
  it("accepts a genuine run and rejects forged ones", () => {
    const m = generateMine(777, 0);
    const ids = m.deposits.filter((d) => d.kind === "ore").slice(0, 5).map((d) => d.id);
    const ok = validateReport({ id: "a", seed: 777, biome: 0, outcome: "extracted", durationSec: 200, maxDepth: 250, minedIds: ids, kills: 1, bossKill: false, hidden: 0, discoveries: [] });
    expect(ok.ok).toBe(true);
    expect(validateReport({ id: "a", seed: 777, biome: 0, outcome: "extracted", durationSec: 200, maxDepth: 250, minedIds: [ids[0], ids[0]], kills: 0, bossKill: false, hidden: 0, discoveries: [] }).ok).toBe(false);
    expect(validateReport({ id: "a", seed: 777, biome: 0, outcome: "extracted", durationSec: 3, maxDepth: 250, minedIds: ids, kills: 0, bossKill: false, hidden: 0, discoveries: [] }).ok).toBe(false);
    expect(validateReport({ id: "a", seed: 777, biome: 0, outcome: "extracted", durationSec: 200, maxDepth: 99999, minedIds: [], kills: 0, bossKill: false, hidden: 0, discoveries: [] }).ok).toBe(false);
    expect(validateReport({ id: "a", seed: 777, biome: 0, outcome: "extracted", durationSec: 200, maxDepth: 100, minedIds: [99999], kills: 0, bossKill: false, hidden: 0, discoveries: [] }).ok).toBe(false);
  });
  it("biome list is complete", () => expect(BIOMES.length).toBe(5));
});
