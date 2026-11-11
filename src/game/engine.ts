/**
 * DERİNLİK expedition simulation. Pure TypeScript — no DOM, no rendering — so mining,
 * combat, oxygen, extraction and death can be unit-tested headlessly.
 * Coordinates: world x/z in metres, facing f => forward vector (sin f, cos f).
 */
import { BASE, BIOMES, CREATURES, RESOURCES, rarityIdx, type CreatureDef, type ResourceId } from "./config";
import { Rng, TH, TILE, TW, depthAt, generateMine, hash2, toTile, type Deposit, type Mine, type Room } from "./gen";
import { backpackWeight, type PlayerStats, type RunResult } from "./economy";

export interface Ev { t: string; x?: number; z?: number; n?: number; res?: ResourceId; s?: string; big?: boolean }
export interface Input { mx: number; mz: number; mining: boolean; extracting: boolean }
export interface DepState { d: Deposit; hp: number; alive: boolean; hit: number }
export type EnemyState = "idle" | "chase" | "windup" | "attack" | "dead" | "stunned";
export interface Enemy {
  id: number; def: CreatureDef; x: number; z: number; hx: number; hz: number; hp: number; maxHp: number; state: EnemyState;
  stateT: number; facing: number; atkCd: number; stun: number; hit: number; deadT: number; wa: number; wt: number; walking: boolean;
  seen: number; boss: boolean; atkCount: number; slam: boolean; aggro: boolean; moving: boolean; lunge: number;
}
export interface EngineOptions {
  seed: number; biome: number; stats: PlayerStats; carry: { medkit: number; oxygenCan: number }; known: string[];
  runId: string; lostPack?: { res: Record<string, number>; frac: number } | null; mine?: Mine;
}

export const ABILITY_CD = [6, 16, 24];
export const ABILITY_ENERGY = [12, 18, 14];
export const DODGE_CD = 1.1;
export const ATTACK_CD = 0.45;
const REACH_ORE = 2.9;
const REACH_SECRET = 5.2;

export class Expedition {
  mine: Mine;
  tiles: Uint8Array;
  tilesVersion = 0;
  stats: PlayerStats;
  biomeIdx: number;
  seed: number;
  runId: string;
  rng: Rng;
  time = 0;
  status: "running" | "extracted" | "dead" = "running";
  events: Ev[] = [];
  p = { x: 0, z: 0, facing: 0, hp: 0, oxygen: 0, energy: 0, shield: 0, shieldT: 0, invuln: 0, flareT: 0, atkT: 0, mineAnim: 0, moving: false, dodgeAnim: 0, hurtT: 0 };
  cd = { atk: 0, dodge: 0, ab: [0, 0, 0] };
  dash = { t: 0, vx: 0, vz: 0 };
  deposits: DepState[] = [];
  enemies: Enemy[] = [];
  bp: Record<string, number> = {};
  coins = 0;
  xp = 0;
  carry: { medkit: number; oxygenCan: number };
  known: Set<string>;
  explored = new Uint8Array(TW * TH);
  exitFound: boolean[] = [];
  extractT = 0;
  nearDep: number | null = null;
  lastDir = { x: 0, z: 1 };
  lostPack: { x: number; z: number; res: Record<string, number>; taken: boolean } | null = null;
  run = {
    counters: {} as Record<string, number>, minedIds: [] as number[], killCount: 0, boss: false, hidden: new Set<number>(),
    maxDepth: 0, discoveries: [] as { res: ResourceId; depth: number; t: number }[], lostPackTaken: false,
  };
  private mineAcc = 0;
  private mineIdle = 0;
  private mineTarget: number | null = null;
  private warn: Record<string, number> = {};
  private envAcc = 0;
  private inHaz = new Set<number>();
  private trapHit = new Map<number, number>();
  private lastTile = -1;
  private suffocate = 0;
  bossEngaged = false;

  constructor(o: EngineOptions) {
    this.seed = o.seed >>> 0;
    this.biomeIdx = o.biome;
    this.runId = o.runId;
    this.mine = o.mine ?? generateMine(this.seed, this.biomeIdx);
    this.tiles = this.mine.tiles.slice();
    this.stats = o.stats;
    this.rng = new Rng(hash2(this.seed, 777));
    this.carry = { ...o.carry };
    this.known = new Set(o.known);
    this.p.x = this.mine.start.x;
    this.p.z = this.mine.start.z;
    this.p.hp = o.stats.maxHp;
    this.p.oxygen = o.stats.maxOxygen;
    this.p.energy = o.stats.maxEnergy;
    this.deposits = this.mine.deposits.map((d) => ({ d, hp: d.durability, alive: true, hit: 0 }));
    this.exitFound = this.mine.exits.map((_, i) => i === 0);
    for (const s of this.mine.spawns) {
      const def = CREATURES[s.creature];
      const hp = def.hp;
      this.enemies.push({
        id: s.id, def, x: s.x, z: s.z, hx: s.x, hz: s.z, hp, maxHp: hp, state: "idle", stateT: 0, facing: this.rng.next() * 6.28,
        atkCd: 1, stun: 0, hit: 0, deadT: 0, wa: 0, wt: 0, walking: false, seen: 0, boss: !!def.boss, atkCount: 0, slam: false, aggro: false, moving: false, lunge: 0,
      });
    }
    if (o.lostPack) this.placeLostPack(o.lostPack);
    this.markExplored();
  }

  /* ----------------------------- world queries ----------------------------- */
  depth(): number { return depthAt(this.biomeIdx, this.p.z); }
  private solidAt(tx: number, tz: number) {
    return tx < 0 || tz < 0 || tx >= TW || tz >= TH || this.tiles[tz * TW + tx] !== 1;
  }
  blockedAt(x: number, z: number, r: number, deps = true): boolean {
    const x0 = toTile(x - r), x1 = toTile(x + r), z0 = toTile(z - r), z1 = toTile(z + r);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      if (!this.solidAt(tx, tz)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const cz = Math.max(tz * TILE, Math.min(z, (tz + 1) * TILE));
      if (Math.hypot(x - cx, z - cz) < r) return true;
    }
    if (deps) for (const ds of this.deposits) {
      if (!ds.alive || ds.d.kind !== "ore") continue;
      if (Math.abs(ds.d.x - x) < 2 && Math.abs(ds.d.z - z) < 2 && Math.hypot(ds.d.x - x, ds.d.z - z) < r + 0.8) return true;
    }
    return false;
  }
  private tryMove(e: { x: number; z: number }, dx: number, dz: number, r: number) {
    if (!this.blockedAt(e.x + dx, e.z, r)) e.x += dx;
    if (!this.blockedAt(e.x, e.z + dz, r)) e.z += dz;
  }
  private los(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / 1.0);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidAt(toTile(ax + (bx - ax) * t), toTile(az + (bz - az) * t))) return false;
    }
    return true;
  }
  private emit(e: Ev) { this.events.push(e); }
  drainEvents(): Ev[] { const e = this.events; this.events = []; return e; }
  private throttle(key: string, every: number): boolean {
    if ((this.warn[key] ?? -99) + every > this.time) return false;
    this.warn[key] = this.time;
    return true;
  }
  private count(key: string, n = 1) { this.run.counters[key] = (this.run.counters[key] ?? 0) + n; }
  private markExplored() {
    const tx = toTile(this.p.x), tz = toTile(this.p.z);
    const k = tz * TW + tx;
    if (k === this.lastTile) return;
    this.lastTile = k;
    const R = 7;
    for (let z = tz - R; z <= tz + R; z++) for (let x = tx - R; x <= tx + R; x++) {
      if (x < 0 || z < 0 || x >= TW || z >= TH) continue;
      if ((x - tx) ** 2 + (z - tz) ** 2 <= R * R) this.explored[z * TW + x] = 1;
    }
  }
  private placeLostPack(lp: { res: Record<string, number>; frac: number }) {
    const target = lp.frac * TH;
    const cands = this.mine.rooms.filter((r) => r.kind !== "start" && r.kind !== "hidden");
    cands.sort((a, b) => Math.abs(a.cy - target) - Math.abs(b.cy - target));
    for (const room of cands) {
      const spot = this.freeSpot(room);
      if (spot) { this.lostPack = { x: spot.x, z: spot.z, res: { ...lp.res }, taken: false }; return; }
    }
  }
  private freeSpot(room: Room): { x: number; z: number } | null {
    for (let dy = 0; dy < room.h; dy++) for (let dx = 0; dx < room.w; dx++) {
      const x = room.cx + ((dx % 2 ? 1 : -1) * Math.ceil(dx / 2)), y = room.cy + ((dy % 2 ? 1 : -1) * Math.ceil(dy / 2));
      if (this.solidAt(x, y)) continue;
      const wx = (x + 0.5) * TILE, wz = (y + 0.5) * TILE;
      if (!this.blockedAt(wx, wz, 0.9)) return { x: wx, z: wz };
    }
    return null;
  }

  /* ----------------------------- player actions ----------------------------- */
  private get alive() { return this.status === "running"; }
  damagePlayer(raw: number) {
    if (!this.alive || this.p.invuln > 0) return;
    let dmg = (raw * 100) / (100 + this.stats.armor * 4);
    if (this.p.shield > 0) {
      const a = Math.min(this.p.shield, dmg);
      this.p.shield -= a; dmg -= a;
      this.emit({ t: "shieldHit", x: this.p.x, z: this.p.z });
    }
    if (dmg > 0.4) {
      this.p.hp -= dmg;
      this.p.hurtT = 0.25;
      this.emit({ t: "hurt", n: Math.round(dmg), x: this.p.x, z: this.p.z });
    }
    this.p.invuln = 0.25;
    if (this.p.hp <= 0) this.die();
  }
  private envDamage(amount: number) {
    if (!this.alive) return;
    this.p.hp -= amount;
    this.envAcc += amount;
    if (this.envAcc >= 3) { this.emit({ t: "hurt", n: Math.round(this.envAcc), x: this.p.x, z: this.p.z, s: "env" }); this.envAcc = 0; this.p.hurtT = 0.2; }
    if (this.p.hp <= 0) this.die();
  }
  private die() {
    if (this.status !== "running") return;
    this.p.hp = 0;
    this.status = "dead";
    this.emit({ t: "dead" });
  }
  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x - this.p.x, e.z - this.p.z) - e.def.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  attack(): boolean {
    if (!this.alive || this.cd.atk > 0 || this.dash.t > 0) return false;
    this.cd.atk = ATTACK_CD;
    this.p.atkT = 0.3;
    const t = this.nearestEnemy(4.2);
    if (t) this.p.facing = Math.atan2(t.x - this.p.x, t.z - this.p.z);
    this.emit({ t: "swing", x: this.p.x, z: this.p.z });
    this.strikeArc(3.2, 70, 1);
    return true;
  }
  private strikeArc(range: number, halfDeg: number, mult: number) {
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      const dx = e.x - this.p.x, dz = e.z - this.p.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.def.radius) continue;
      let da = Math.abs(Math.atan2(dx, dz) - this.p.facing);
      da = Math.min(da, Math.PI * 2 - da);
      if (da > (halfDeg * Math.PI) / 180 && d > e.def.radius + 0.8) continue;
      const crit = this.rng.chance(0.12);
      const dmg = this.stats.attack * (0.9 + this.rng.next() * 0.2) * (crit ? 1.6 : 1) * mult;
      this.hurtEnemy(e, dmg, crit);
    }
  }
  private hurtEnemy(e: Enemy, dmg: number, crit: boolean) {
    if (e.state === "dead") return;
    e.hp -= dmg;
    e.hit = 0.18;
    this.emit({ t: "hit", x: e.x, z: e.z, n: Math.round(dmg), big: crit });
    if (!e.aggro) { e.aggro = true; e.state = "chase"; }
    if (!e.boss) {
      const d = Math.hypot(e.x - this.p.x, e.z - this.p.z) || 1;
      this.tryMove(e, ((e.x - this.p.x) / d) * 0.5, ((e.z - this.p.z) / d) * 0.5, e.def.radius);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    e.state = "dead"; e.deadT = 0; e.hp = 0;
    this.run.killCount++;
    this.count("kill:any");
    this.count("kill:" + e.def.id);
    if (e.def.model !== e.def.id && !e.boss) this.count("kill:" + e.def.model);
    this.coins += e.def.coins;
    this.xp += e.def.xp;
    this.emit({ t: "enemyDie", x: e.x, z: e.z, s: e.def.id, big: e.boss });
    for (const l of e.def.loot) {
      if (!this.rng.chance(l.chance)) continue;
      const q = this.rng.int(l.qty[0], l.qty[1]);
      const got = this.addLoot(l.res, q);
      if (got > 0) this.emit({ t: "pickup", res: l.res, n: got, x: e.x, z: e.z });
    }
    if (e.boss) {
      this.run.boss = true;
      this.count("boss");
      this.emit({ t: "bossDead", x: e.x, z: e.z });
    }
  }
  /** Adds resource respecting backpack capacity. Returns the amount actually added. */
  private addLoot(res: ResourceId, qty: number): number {
    const w = RESOURCES[res].weight;
    const free = this.stats.capacity - backpackWeight(this.bp);
    const fit = Math.max(0, Math.min(qty, Math.floor((free + 1e-9) / w)));
    if (fit <= 0) { if (this.throttle("full", 1.5)) this.emit({ t: "full" }); return 0; }
    this.bp[res] = (this.bp[res] ?? 0) + fit;
    return fit;
  }
  dodge(dirX?: number, dirZ?: number): boolean {
    if (!this.alive || this.cd.dodge > 0 || this.p.energy < 8) return false;
    this.cd.dodge = DODGE_CD;
    this.p.energy -= 8;
    let dx = dirX ?? this.lastDir.x, dz = dirZ ?? this.lastDir.z;
    const m = Math.hypot(dx, dz) || 1; dx /= m; dz /= m;
    this.dash = { t: 0.3, vx: dx * 12, vz: dz * 12 };
    this.p.invuln = 0.45;
    this.p.dodgeAnim = 0.3;
    this.emit({ t: "dodge", x: this.p.x, z: this.p.z });
    return true;
  }
  ability(i: 0 | 1 | 2): boolean {
    if (!this.alive || this.cd.ab[i] > 0) return false;
    if (this.p.energy < ABILITY_ENERGY[i]) { if (this.throttle("noEnergy", 1)) this.emit({ t: "noEnergy" }); return false; }
    this.p.energy -= ABILITY_ENERGY[i];
    this.cd.ab[i] = ABILITY_CD[i];
    if (i === 0) {
      const t = this.nearestEnemy(7);
      if (t) this.p.facing = Math.atan2(t.x - this.p.x, t.z - this.p.z);
      this.strikeArc(4.6, 60, 2.2);
      this.dash = { t: 0.22, vx: Math.sin(this.p.facing) * 15, vz: Math.cos(this.p.facing) * 15 };
      this.p.atkT = 0.3;
      this.emit({ t: "strike", x: this.p.x, z: this.p.z });
    } else if (i === 1) {
      this.p.shield = 40 + this.stats.armor * 2;
      this.p.shieldT = 6;
      this.emit({ t: "shield", x: this.p.x, z: this.p.z });
    } else {
      this.p.flareT = 6;
      for (const e of this.enemies) {
        if (e.state === "dead") continue;
        if (Math.hypot(e.x - this.p.x, e.z - this.p.z) < 12) { e.stun = e.boss ? 1.5 : 4; e.state = "stunned"; }
      }
      this.emit({ t: "flare", x: this.p.x, z: this.p.z });
    }
    return true;
  }
  useMedkit(): boolean {
    if (!this.alive || this.carry.medkit <= 0 || this.p.hp >= this.stats.maxHp) return false;
    this.carry.medkit--;
    this.p.hp = Math.min(this.stats.maxHp, this.p.hp + this.stats.medkitHeal);
    this.emit({ t: "heal", n: this.stats.medkitHeal });
    return true;
  }
  useOxygenCan(): boolean {
    if (!this.alive || this.carry.oxygenCan <= 0 || this.p.oxygen >= this.stats.maxOxygen - 5) return false;
    this.carry.oxygenCan--;
    this.p.oxygen = Math.min(this.stats.maxOxygen, this.p.oxygen + 90);
    this.emit({ t: "heal", n: 0, s: "oxygen" });
    return true;
  }

  /* ----------------------------- mining ----------------------------- */
  private findNearDeposit(): number | null {
    let best: number | null = null, bd = 1e9;
    for (let i = 0; i < this.deposits.length; i++) {
      const ds = this.deposits[i];
      if (!ds.alive) continue;
      const reach = ds.d.kind === "secret" ? REACH_SECRET : REACH_ORE;
      const d = Math.hypot(ds.d.x - this.p.x, ds.d.z - this.p.z);
      if (d <= reach && d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** damage a single pickaxe hit deals to a deposit */
  hitDamage(res: ResourceId | null): number {
    const hard = res ? RESOURCES[res].hardness : 1;
    return (this.stats.tool.power * this.stats.power) / (1 + 0.1 * hard);
  }
  private doMineHit(ds: DepState): void {
    const res = ds.d.res;
    const def = res ? RESOURCES[res] : null;
    if (def && this.stats.tool.level < def.toolLevel) { if (this.throttle("weak", 1.4)) this.emit({ t: "weak", res: def.id, n: def.toolLevel }); return; }
    if (def && this.stats.capacity - backpackWeight(this.bp) + 1e-9 < def.weight) { if (this.throttle("full", 1.5)) this.emit({ t: "full" }); return; }
    if (this.p.energy < this.stats.tool.energy) { if (this.throttle("noEnergy", 1)) this.emit({ t: "noEnergy" }); return; }
    this.p.energy -= this.stats.tool.energy;
    const dmg = this.hitDamage(res);
    ds.hp -= dmg;
    ds.hit = 0.16;
    this.p.mineAnim = 0.25;
    this.emit({ t: "mineHit", x: ds.d.x, z: ds.d.z, res: res ?? undefined, n: Math.round(dmg), s: ds.d.kind });
    if (ds.hp <= 0) this.breakDeposit(ds);
  }
  private breakDeposit(ds: DepState) {
    ds.alive = false; ds.hp = 0;
    const d = ds.d;
    if (d.kind === "secret") {
      for (const i of d.secretTiles ?? []) this.tiles[i] = 1;
      this.tilesVersion++;
      this.emit({ t: "secret", x: d.x, z: d.z });
      return;
    }
    const res = d.res as ResourceId;
    let qty = d.qty;
    if (this.rng.chance(this.stats.tool.yieldBonus)) qty += 1;
    const got = this.addLoot(res, qty);
    this.run.minedIds.push(d.id);
    this.count("mine:any");
    this.count("mine:" + res);
    this.emit({ t: "break", x: d.x, z: d.z, res });
    if (got > 0) this.emit({ t: "pickup", res, n: got, x: d.x, z: d.z });
    const r = RESOURCES[res];
    const fresh = !this.known.has(res);
    if (fresh || rarityIdx(r.rarity) >= 4) {
      this.known.add(res);
      if (rarityIdx(r.rarity) >= 2) this.run.discoveries.push({ res, depth: this.depth(), t: this.time });
      this.emit({ t: "discover", res, n: this.depth(), big: rarityIdx(r.rarity) >= 2 });
    }
  }

  /* ----------------------------- tick ----------------------------- */
  paused = false;
  /** Player gives up the expedition: handled exactly like a death (loot penalty applies). */
  abandon() { this.die(); }
  tick(dtRaw: number, inp: Input) {
    if (!this.alive || this.paused) return;
    const dt = Math.min(dtRaw, 0.05);
    this.time += dt;
    const p = this.p;
    p.invuln = Math.max(0, p.invuln - dt);
    p.atkT = Math.max(0, p.atkT - dt);
    p.mineAnim = Math.max(0, p.mineAnim - dt);
    p.dodgeAnim = Math.max(0, p.dodgeAnim - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.flareT = Math.max(0, p.flareT - dt);
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    this.cd.atk = Math.max(0, this.cd.atk - dt);
    this.cd.dodge = Math.max(0, this.cd.dodge - dt);
    for (let i = 0; i < 3; i++) this.cd.ab[i] = Math.max(0, this.cd.ab[i] - dt);
    for (const ds of this.deposits) ds.hit = Math.max(0, ds.hit - dt);

    // movement
    let speedMul = 1;
    for (const h of this.mine.hazards) if (h.type === "water" && Math.hypot(h.x - p.x, h.z - p.z) < h.r) speedMul = 0.7;
    const mag = Math.min(1, Math.hypot(inp.mx, inp.mz));
    p.moving = false;
    if (this.dash.t > 0) {
      this.dash.t -= dt;
      this.tryMove(p, this.dash.vx * dt, this.dash.vz * dt, 0.45);
    } else if (mag > 0.08) {
      const dx = inp.mx / mag, dz = inp.mz / mag;
      this.lastDir = { x: dx, z: dz };
      p.facing = Math.atan2(dx, dz);
      const sp = this.stats.speed * speedMul * mag * (inp.mining && this.mineTarget !== null ? 0.5 : 1);
      this.tryMove(p, dx * sp * dt, dz * sp * dt, 0.45);
      p.moving = true;
    }

    // mining
    this.nearDep = this.findNearDeposit();
    if (inp.mining && this.nearDep !== null && this.dash.t <= 0) {
      const ds = this.deposits[this.nearDep];
      if (this.mineTarget !== this.nearDep) { this.mineTarget = this.nearDep; this.mineAcc = 0.6; }
      if (!p.moving) p.facing = Math.atan2(ds.d.x - p.x, ds.d.z - p.z);
      this.mineAcc += dt * this.stats.tool.speed * this.stats.speedMult;
      this.mineIdle = 0;
      while (this.mineAcc >= 1 && ds.alive) { this.mineAcc -= 1; this.doMineHit(ds); }
    } else {
      this.mineTarget = null; this.mineAcc = 0; this.mineIdle += dt;
    }
    // energy regen
    p.energy = Math.min(this.stats.maxEnergy, p.energy + (this.mineIdle > 0.7 ? 5 : this.mineTarget !== null ? 0.8 : 3) * dt);

    this.updateEnvironment(dt);
    this.updateEnemies(dt);
    this.updateWorldTriggers(inp, dt);
    this.markExplored();
    this.run.maxDepth = Math.max(this.run.maxDepth, this.depth());
  }

  private updateEnvironment(dt: number) {
    const p = this.p, b = BIOMES[this.biomeIdx];
    const depthF = this.depth() / Math.max(1, b.maxDepth);
    const sr = this.mine.rooms.find((r) => r.kind === "start") as Room;
    const inStart = toTile(p.x) >= sr.x - 1 && toTile(p.x) < sr.x + sr.w + 1 && toTile(p.z) >= sr.y - 1 && toTile(p.z) < sr.y + sr.h + 1;
    let drain = b.oxygenDrain * (1 + depthF * 0.15);
    // hazards
    const cur = new Set<number>();
    for (const h of this.mine.hazards) {
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d >= h.r) continue;
      cur.add(h.id);
      if (!this.inHaz.has(h.id) && this.throttle("haz" + h.type, 2.5)) this.emit({ t: "hazard", s: h.type });
      if (h.type === "gas") drain += 4;
      else if (h.type === "lava") this.envDamage(18 * (1 - this.stats.heat) * this.stats.hazardMult * dt);
      else if (h.type === "heat") this.envDamage(3.5 * (1 - this.stats.heat) * this.stats.hazardMult * dt);
      else if (h.type === "trap") {
        const phase = (this.time + h.id * 0.7) % 3;
        const cycle = Math.floor((this.time + h.id * 0.7) / 3);
        if (phase < 0.6 && this.trapHit.get(h.id) !== cycle) {
          this.trapHit.set(h.id, cycle);
          this.damagePlayer(22 * this.stats.hazardMult);
        }
      }
    }
    this.inHaz = cur;
    if (inStart) p.oxygen = Math.min(this.stats.maxOxygen, p.oxygen + 25 * dt);
    else p.oxygen = Math.max(0, p.oxygen - drain * dt);
    if (p.oxygen <= 0) {
      this.suffocate += dt;
      this.envDamage(8 * dt);
      if (this.throttle("suffocate", 1.2)) this.emit({ t: "lowO2", s: "zero" });
    } else this.suffocate = 0;
    if (p.oxygen / this.stats.maxOxygen < 0.2 && p.oxygen > 0 && this.throttle("lowO2", 3)) this.emit({ t: "lowO2" });
    if (p.hp / this.stats.maxHp < 0.25 && this.throttle("lowHp", 4)) this.emit({ t: "lowHp" });
  }

  private updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.state === "dead") { e.deadT += dt; continue; }
      e.hit = Math.max(0, e.hit - dt);
      e.atkCd -= dt;
      e.lunge = Math.max(0, e.lunge - dt);
      e.moving = false;
      if (e.stun > 0) {
        e.stun -= dt; e.state = "stunned";
        if (e.stun <= 0) e.state = e.aggro ? "chase" : "idle";
        continue;
      }
      const dx = p.x - e.x, dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      const detect = e.def.detect * (p.flareT > 0 ? 1.4 : 1);
      const enrage = e.boss && e.hp < e.maxHp * 0.5 ? 1.3 : 1;
      if (e.state === "idle") {
        e.wt -= dt;
        if (e.wt <= 0) { e.wa = this.rng.next() * 6.283; e.wt = 1.5 + this.rng.next() * 2; e.walking = this.rng.chance(0.5); }
        if (e.walking && !e.boss) {
          const nx = e.x + Math.sin(e.wa) * e.def.speed * 0.3 * dt, nz = e.z + Math.cos(e.wa) * e.def.speed * 0.3 * dt;
          if (Math.hypot(nx - e.hx, nz - e.hz) < 6 && !this.blockedAt(nx, nz, e.def.radius)) { e.x = nx; e.z = nz; e.facing = e.wa; e.moving = true; }
        }
        if (this.alive && dist < detect && this.los(e.x, e.z, p.x, p.z)) {
          e.state = "chase"; e.aggro = true;
          if (e.boss && !this.bossEngaged) { this.bossEngaged = true; this.emit({ t: "bossStart", s: e.def.id }); }
        }
      } else if (e.state === "chase") {
        if (!this.alive) { e.state = "idle"; continue; }
        e.facing = Math.atan2(dx, dz);
        const visible = this.los(e.x, e.z, p.x, p.z);
        e.seen = visible ? 0 : e.seen + dt;
        if (dist > detect * 2 || e.seen > 4) { e.state = "idle"; e.aggro = false; continue; }
        if (e.boss && !this.bossEngaged) { this.bossEngaged = true; this.emit({ t: "bossStart", s: e.def.id }); }
        const reach = e.def.range + e.def.radius * 0.3;
        if (dist > reach * 0.85) this.steer(e, p.x, p.z, e.def.speed * enrage, dt);
        if (dist <= reach + 0.3 && e.atkCd <= 0) {
          e.atkCount++;
          e.slam = e.boss && e.atkCount % 3 === 0;
          e.state = "windup"; e.stateT = e.slam ? 1.0 : e.def.windup;
          this.emit({ t: "enemyWindup", x: e.x, z: e.z, big: e.slam });
        }
      } else if (e.state === "windup") {
        e.stateT -= dt;
        e.facing = Math.atan2(dx, dz);
        if (e.stateT <= 0) {
          const range = e.slam ? 5.5 : e.def.range + e.def.radius * 0.3 + 0.5;
          e.state = "attack"; e.stateT = 0.3; e.lunge = 0.3;
          e.atkCd = e.def.cooldown / enrage;
          this.emit({ t: "enemyAtk", x: e.x, z: e.z, big: e.slam });
          if (dist <= range && this.alive) this.damagePlayer(e.def.damage * (e.slam ? 1.5 : 1));
        }
      } else if (e.state === "attack") {
        e.stateT -= dt;
        if (e.stateT <= 0) e.state = "chase";
      }
    }
  }
  private steer(e: Enemy, tx: number, tz: number, spd: number, dt: number) {
    const base = Math.atan2(tx - e.x, tz - e.z);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = base + off;
      const nx = e.x + Math.sin(a) * spd * dt, nz = e.z + Math.cos(a) * spd * dt;
      if (!this.blockedAt(nx, nz, e.def.radius)) { e.x = nx; e.z = nz; e.moving = true; return; }
    }
  }

  private updateWorldTriggers(inp: Input, dt: number) {
    const p = this.p;
    const tx = toTile(p.x), tz = toTile(p.z);
    for (const id of this.mine.hiddenRooms) {
      if (this.run.hidden.has(id)) continue;
      const r = this.mine.rooms[id];
      if (tx >= r.x && tx < r.x + r.w && tz >= r.y && tz < r.y + r.h) {
        this.run.hidden.add(id);
        this.emit({ t: "hidden" });
      }
    }
    this.mine.exits.forEach((e, i) => {
      if (!this.exitFound[i] && Math.hypot(e.x - p.x, e.z - p.z) < 9) { this.exitFound[i] = true; this.emit({ t: "exitFound", s: e.kind }); }
    });
    const lp = this.lostPack;
    if (lp && !lp.taken && Math.hypot(lp.x - p.x, lp.z - p.z) < 2.2) {
      lp.taken = true;
      this.run.lostPackTaken = true;
      for (const [k, n] of Object.entries(lp.res)) this.addLoot(k as ResourceId, n);
      this.emit({ t: "lostPack", x: lp.x, z: lp.z });
    }
    const ne = this.nearestExit();
    if (inp.extracting && ne && ne.dist < 3.4) {
      if (this.extractT === 0) this.emit({ t: "extractStart" });
      this.extractT += dt;
      if (this.extractT >= 2) { this.status = "extracted"; this.emit({ t: "extracted" }); }
    } else this.extractT = Math.max(0, this.extractT - dt * 2);
  }
  nearestExit(): { dist: number; angle: number; kind: string; x: number; z: number } | null {
    let best: { dist: number; angle: number; kind: string; x: number; z: number } | null = null;
    this.mine.exits.forEach((e, i) => {
      if (!this.exitFound[i]) return;
      const d = Math.hypot(e.x - this.p.x, e.z - this.p.z);
      if (!best || d < best.dist) best = { dist: d, angle: Math.atan2(e.x - this.p.x, e.z - this.p.z), kind: e.kind, x: e.x, z: e.z };
    });
    return best;
  }

  /* ----------------------------- output ----------------------------- */
  snapshot() {
    const ne = this.nearestExit();
    const boss = this.enemies.find((e) => e.boss && e.state !== "dead" && this.bossEngaged) ?? null;
    const nd = this.nearDep !== null ? this.deposits[this.nearDep] : null;
    const ndRes = nd?.d.res ? RESOURCES[nd.d.res] : null;
    return {
      hp: this.p.hp, maxHp: this.stats.maxHp, oxygen: this.p.oxygen, maxOxygen: this.stats.maxOxygen,
      energy: this.p.energy, maxEnergy: this.stats.maxEnergy, weight: backpackWeight(this.bp), capacity: this.stats.capacity,
      depth: this.depth(), time: this.time, status: this.status, cd: { atk: this.cd.atk, dodge: this.cd.dodge, ab: [...this.cd.ab] },
      carry: { ...this.carry }, shield: this.p.shield, extractT: this.extractT, coins: this.coins,
      exit: ne ? { dist: ne.dist, angle: ne.angle, kind: ne.kind } : null,
      boss: boss ? { hp: boss.hp, max: boss.maxHp, name: boss.def.name } : null,
      near: nd ? { res: nd.d.res, ratio: nd.hp / nd.d.durability, locked: !!ndRes && this.stats.tool.level < ndRes.toolLevel, need: ndRes?.toolLevel ?? 0, secret: nd.d.kind === "secret" } : null,
      bp: { ...this.bp }, hidden: this.run.hidden.size, kills: this.run.killCount, lostPack: this.lostPack && !this.lostPack.taken ? true : false,
    };
  }
  result(startedAt?: number): RunResult {
    void startedAt;
    return {
      id: this.runId, seed: this.seed, biome: this.biomeIdx, outcome: this.status === "extracted" ? "extracted" : "died",
      durationSec: this.time, backpack: { ...this.bp }, coins: this.coins,
      xp: Math.round(this.xp + this.run.maxDepth / 10 + (this.status === "extracted" ? 20 : 0)),
      counters: { ...this.run.counters }, maxDepth: this.run.maxDepth, hidden: this.run.hidden.size, boss: this.run.boss,
      kills: this.run.killCount, minedIds: [...this.run.minedIds], discoveries: [...this.run.discoveries],
      carryLeft: { ...this.carry }, lostPackTaken: this.run.lostPackTaken, deathDepthFrac: this.p.z / (TH * TILE),
    };
  }
}

export { BASE };
