/**
 * Deterministic procedural mine generator.
 * Same (seed, biome) => identical mine on every client and on the server.
 * Guarantees (validated on every attempt, see `validateMine`):
 *  - valid start tile, elevator exit
 *  - every normal room (incl. boss + shortcut room) reachable without breaking walls
 *  - hidden rooms ONLY reachable through a breakable cracked wall
 *  - deposits never disconnect the map
 */
import { BIOMES, CREATURES, RESOURCES, rarityIdx, type CreatureId, type PropKind, type ResourceId } from "./config";

export const TILE = 2;
export const CELL = 14;
export const CX = 3;
export const CY = 6;
export const TW = CX * CELL;
export const TH = CY * CELL;

export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

export class Rng {
  private a: number;
  constructor(seed: number) {
    this.a = seed >>> 0;
  }
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export type RoomKind = "start" | "normal" | "boss" | "hidden" | "shortcut";
export type Template = "chamber" | "pillared" | "cavern" | "cross";
export interface Room {
  id: number; kind: RoomKind; template: Template; x: number; y: number; w: number; h: number;
  cx: number; cy: number; cellX: number; cellY: number; dark: boolean;
}
export interface Deposit {
  id: number; kind: "ore" | "secret"; res: ResourceId | null; x: number; z: number; qty: number;
  durability: number; room: number; rot: number; scale: number; secretTiles?: number[];
}
export interface Spawn { id: number; creature: string; x: number; z: number; room: number; boss: boolean }
export interface Hazard { id: number; type: "gas" | "lava" | "heat" | "trap" | "water"; x: number; z: number; r: number }
export interface Prop { kind: PropKind; x: number; z: number; rot: number; scale: number }
export interface ExitPoint { x: number; z: number; kind: "elevator" | "shortcut" }
export interface Mine {
  seed: number; biome: number; attempt: number; tiles: Uint8Array; rooms: Room[]; deposits: Deposit[];
  spawns: Spawn[]; hazards: Hazard[]; props: Prop[]; start: { x: number; z: number }; exits: ExitPoint[];
  bossRoom: number; bossId: string; hiddenRooms: number[]; valid: boolean;
}

export const tileCenter = (t: number) => (t + 0.5) * TILE;
export const toTile = (w: number) => Math.floor(w / TILE);
export function depthAt(biome: number, z: number): number {
  const b = BIOMES[biome];
  const f = Math.max(0, Math.min(1, z / (TH * TILE)));
  return Math.round(b.minDepth + f * (b.maxDepth - b.minDepth));
}

function bfs(tiles: Uint8Array, sx: number, sy: number, passSecret: boolean, blocked?: Uint8Array): Uint8Array {
  const vis = new Uint8Array(TW * TH);
  const q = new Int32Array(TW * TH);
  const ok = (i: number) => {
    const v = tiles[i];
    return (v === 1 || (passSecret && v === 2)) && !(blocked && blocked[i]);
  };
  const s = sy * TW + sx;
  if (!ok(s)) return vis;
  let h = 0, t = 0;
  q[t++] = s;
  vis[s] = 1;
  while (h < t) {
    const c = q[h++];
    const x = c % TW, y = (c / TW) | 0;
    if (x > 0 && !vis[c - 1] && ok(c - 1)) { vis[c - 1] = 1; q[t++] = c - 1; }
    if (x < TW - 1 && !vis[c + 1] && ok(c + 1)) { vis[c + 1] = 1; q[t++] = c + 1; }
    if (y > 0 && !vis[c - TW] && ok(c - TW)) { vis[c - TW] = 1; q[t++] = c - TW; }
    if (y < TH - 1 && !vis[c + TW] && ok(c + TW)) { vis[c + TW] = 1; q[t++] = c + TW; }
  }
  return vis;
}

function carveRoom(tiles: Uint8Array, r: Room, rng: Rng) {
  const set = (x: number, y: number) => { if (x > 0 && y > 0 && x < TW - 1 && y < TH - 1) tiles[y * TW + x] = 1; };
  const wall = (x: number, y: number) => { tiles[y * TW + x] = 0; };
  if (r.template === "cavern") {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const dx = (x + 0.5 - r.w / 2) / (r.w / 2), dy = (y + 0.5 - r.h / 2) / (r.h / 2);
      if (dx * dx + dy * dy <= 1.05 + (rng.next() - 0.5) * 0.18) set(r.x + x, r.y + y);
    }
    return;
  }
  if (r.template === "cross") {
    const bw = Math.max(3, Math.floor(r.w / 2)), bh = Math.max(3, Math.floor(r.h / 2));
    const ox = Math.floor((r.w - bw) / 2), oy = Math.floor((r.h - bh) / 2);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if ((y >= oy && y < oy + bh) || (x >= ox && x < ox + bw)) set(r.x + x, r.y + y);
    }
    return;
  }
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) set(r.x + x, r.y + y);
  if (r.template === "pillared") {
    for (let ly = 2; ly < r.h - 2; ly += 3) for (let lx = 2; lx < r.w - 2; lx += 3) wall(r.x + lx, r.y + ly);
  }
}

interface Pt { x: number; y: number }
function pathBetween(a: Room, b: Room): Pt[] {
  const pts: Pt[] = [];
  const sx = Math.sign(b.cx - a.cx) || 1;
  for (let x = a.cx; x !== b.cx; x += sx) pts.push({ x, y: a.cy });
  const sy = Math.sign(b.cy - a.cy) || 1;
  for (let y = a.cy; y !== b.cy; y += sy) pts.push({ x: b.cx, y });
  pts.push({ x: b.cx, y: b.cy });
  return pts;
}
function carvePath(tiles: Uint8Array, pts: Pt[]) {
  for (const p of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < TW - 1 && y < TH - 1) tiles[y * TW + x] = 1;
  }
}
const inRect = (r: Room, x: number, y: number, pad: number) =>
  x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad;

function build(seed: number, biomeIdx: number, attempt: number, hiddenWanted: number): Mine {
  const biome = BIOMES[biomeIdx];
  const rng = new Rng(hash2(seed, attempt * 7919 + biomeIdx * 131));
  const tiles = new Uint8Array(TW * TH);
  const rooms: Room[] = [];
  const startId = 1; // cell (1,0)
  for (let cy = 0; cy < CY; cy++) for (let cx = 0; cx < CX; cx++) {
    const id = cy * CX + cx;
    const w = rng.int(6, 11), h = rng.int(6, 10);
    const x = cx * CELL + rng.int(1, CELL - 1 - w);
    const y = cy * CELL + rng.int(1, CELL - 1 - h);
    const templates: Template[] = biomeIdx === 3 ? ["pillared", "cross", "chamber", "pillared"] : biomeIdx === 1 ? ["cavern", "cavern", "chamber", "cross"] : ["chamber", "pillared", "cavern", "cross"];
    rooms.push({ id, kind: "normal", template: rng.pick(templates), x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), cellX: cx, cellY: cy, dark: false });
  }
  // spanning tree (random Prim)
  const adj = (a: number): number[] => {
    const r = rooms[a]; const out: number[] = [];
    if (r.cellX > 0) out.push(a - 1);
    if (r.cellX < CX - 1) out.push(a + 1);
    if (r.cellY > 0) out.push(a - CX);
    if (r.cellY < CY - 1) out.push(a + CX);
    return out;
  };
  const inTree = new Set<number>([startId]);
  const edges: [number, number][] = [];
  while (inTree.size < rooms.length) {
    const cand: [number, number][] = [];
    for (const a of inTree) for (const b of adj(a)) if (!inTree.has(b)) cand.push([a, b]);
    const e = rng.pick(cand);
    edges.push(e);
    inTree.add(e[1]);
  }
  // tree distances + degrees
  const dist = new Map<number, number>([[startId, 0]]);
  const deg = new Map<number, number>();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) ?? 0) + 1); deg.set(b, (deg.get(b) ?? 0) + 1); }
  for (const [a, b] of edges) dist.set(b, (dist.get(a) ?? 0) + 1); // edges are in insertion order => parent already known
  const lastRow = rooms.filter((r) => r.cellY === CY - 1);
  let boss = lastRow[0];
  for (const r of lastRow) if ((dist.get(r.id) ?? 0) > (dist.get(boss.id) ?? 0)) boss = r;
  boss.kind = "boss"; boss.template = "chamber";
  boss.w = 11; boss.h = 10; boss.x = boss.cellX * CELL + 1; boss.y = boss.cellY * CELL + 2;
  boss.cx = boss.x + 5; boss.cy = boss.y + 5;
  rooms[startId].kind = "start"; rooms[startId].template = "chamber";
  const leaves = rng.shuffle(rooms.filter((r) => r.kind === "normal" && (deg.get(r.id) ?? 0) === 1 && r.cellY >= 1));
  const hiddenIds = leaves.slice(0, hiddenWanted).map((r) => r.id);
  for (const id of hiddenIds) rooms[id].kind = "hidden";
  const half = (dist.get(boss.id) ?? 4) / 2;
  const sc = rooms.filter((r) => r.kind === "normal" && r.cellY >= 2 && r.cellY <= 4).sort((a, b) => Math.abs((dist.get(a.id) ?? 0) - half) - Math.abs((dist.get(b.id) ?? 0) - half));
  if (sc[0]) sc[0].kind = "shortcut";
  for (const r of rooms) r.dark = r.kind === "normal" && biomeIdx >= 1 && rng.chance(0.35);
  // loops (never touching hidden rooms)
  const have = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  const extra: [number, number][] = [];
  for (const r of rng.shuffle(rooms)) {
    if (extra.length >= 3) break;
    if (r.kind === "hidden") continue;
    const b = rng.pick(adj(r.id));
    const k = `${Math.min(r.id, b)}-${Math.max(r.id, b)}`;
    if (have.has(k) || rooms[b].kind === "hidden") continue;
    have.add(k);
    extra.push([r.id, b]);
  }
  for (const r of rooms) carveRoom(tiles, r, rng);
  // corridors
  const secrets: Deposit[] = [];
  let failed = false;
  for (const [a, b] of [...edges, ...extra]) {
    const ra = rooms[a], rb = rooms[b];
    const hiddenSide = ra.kind === "hidden" ? ra : rb.kind === "hidden" ? rb : null;
    if (!hiddenSide) { carvePath(tiles, pathBetween(ra, rb)); continue; }
    const other = hiddenSide === ra ? rb : ra;
    const pts = pathBetween(hiddenSide, other);
    carvePath(tiles, pts);
    let j = -1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!rooms.some((r) => inRect(r, p.x, p.y, 2))) { j = i; break; }
    }
    if (j < 0) { failed = true; continue; }
    const c = pts[j];
    const idxs: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (c.y + dy) * TW + (c.x + dx); tiles[i] = 2; idxs.push(i); }
    secrets.push({ id: -1, kind: "secret", res: null, x: tileCenter(c.x), z: tileCenter(c.y), qty: 0, durability: 90, room: hiddenSide.id, rot: 0, scale: 1, secretTiles: idxs });
  }
  const start = { x: rooms[startId].cx, y: rooms[startId].cy + 1 };
  const exitsT: { x: number; y: number; kind: "elevator" | "shortcut" }[] = [{ x: rooms[startId].cx, y: rooms[startId].cy - 1, kind: "elevator" }];
  const scRoom = rooms.find((r) => r.kind === "shortcut");
  if (scRoom) exitsT.push({ x: scRoom.cx, y: scRoom.cy, kind: "shortcut" });

  const mine: Mine = {
    seed, biome: biomeIdx, attempt, tiles, rooms, deposits: [], spawns: [], hazards: [], props: [],
    start: { x: tileCenter(start.x), z: tileCenter(start.y) },
    exits: exitsT.map((e) => ({ x: tileCenter(e.x), z: tileCenter(e.y), kind: e.kind })),
    bossRoom: boss.id, bossId: biome.boss, hiddenRooms: hiddenIds, valid: false,
  };
  if (failed) return mine;

  // base connectivity before placing anything
  const baseOk = validateConnectivity(mine, hiddenIds);
  if (!baseOk) return mine;

  /* -------- deposits -------- */
  const blocked = new Uint8Array(TW * TH);
  const depTiles: Pt[] = [];
  const keepClear: Pt[] = [{ x: start.x, y: start.y }, ...exitsT.map((e) => ({ x: e.x, y: e.y }))];
  const keyPts = rooms.map((r) => ({ x: r.cx, y: r.cy })).concat(keepClear);
  const canPlace = (x: number, y: number): boolean => {
    const i = y * TW + x;
    if (tiles[i] !== 1 || blocked[i]) return false;
    if (keepClear.some((k) => Math.abs(k.x - x) <= 2 && Math.abs(k.y - y) <= 2)) return false;
    if (depTiles.some((d) => Math.abs(d.x - x) < 2 && Math.abs(d.y - y) < 2)) return false;
    return true;
  };
  const pickRes = (room: Room, treasure: boolean): ResourceId => {
    if (treasure && rng.chance(0.55)) return rng.pick(biome.treasure);
    const rowF = room.cellY / (CY - 1);
    const ws = biome.resources.map((r) => {
      const ri = rarityIdx(RESOURCES[r.id].rarity);
      const f = ri <= 1 ? 1.25 - 0.7 * rowF : 0.6 + 1.2 * rowF * (treasure ? 1.6 : 1);
      return Math.max(0.05, r.w * f);
    });
    let t = rng.next() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ws.length; i++) { t -= ws[i]; if (t <= 0) return biome.resources[i].id; }
    return biome.resources[0].id;
  };
  const placeDeposit = (room: Room, res: ResourceId, forced?: Pt) => {
    for (let tries = 0; tries < 30; tries++) {
      const x = forced ? forced.x : rng.int(room.x + 1, room.x + room.w - 2);
      const y = forced ? forced.y : rng.int(room.y + 1, room.y + room.h - 2);
      if (!canPlace(x, y)) { if (forced) return; continue; }
      blocked[y * TW + x] = 1;
      const vis = bfs(tiles, start.x, start.y, true, blocked);
      const ok = keyPts.every((k) => vis[k.y * TW + k.x]) &&
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => vis[(y + dy) * TW + (x + dx)]);
      if (!ok) { blocked[y * TW + x] = 0; if (forced) return; continue; }
      const def = RESOURCES[res];
      mine.deposits.push({ id: mine.deposits.length, kind: "ore", res, x: tileCenter(x), z: tileCenter(y), qty: rng.int(def.qty[0], def.qty[1]), durability: def.durability, room: room.id, rot: rng.next() * Math.PI * 2, scale: 0.85 + rng.next() * 0.4 });
      depTiles.push({ x, y });
      return;
    }
  };
  for (const r of rooms) {
    if (r.kind === "start") {
      // tutorial deposits right next to the elevator
      const first = biome.resources[0].id, second = biome.resources[1].id;
      placeDeposit(r, first, { x: r.cx - 3, y: r.cy + 1 });
      placeDeposit(r, second, { x: r.cx + 3, y: r.cy + 1 });
      continue;
    }
    const n = r.kind === "hidden" ? 6 : r.kind === "boss" ? 4 : rng.int(3, 5);
    for (let i = 0; i < n; i++) placeDeposit(r, pickRes(r, r.kind === "hidden" || r.kind === "boss"));
  }
  // secrets get final ids
  for (const s of secrets) { s.id = mine.deposits.length; mine.deposits.push(s); }

  /* -------- creature spawns -------- */
  const far = (x: number, y: number) => Math.hypot(x - start.x, y - start.y) >= 8;
  const freeTile = (room: Room, minFar = true): Pt | null => {
    for (let i = 0; i < 40; i++) {
      const x = rng.int(room.x + 1, room.x + room.w - 2), y = rng.int(room.y + 1, room.y + room.h - 2);
      const k = y * TW + x;
      if (tiles[k] === 1 && !blocked[k] && (!minFar || far(x, y))) return { x, y };
    }
    return null;
  };
  const addSpawn = (cid: string, p: Pt, room: number, bossFlag = false) =>
    mine.spawns.push({ id: mine.spawns.length, creature: cid, x: tileCenter(p.x), z: tileCenter(p.y), room, boss: bossFlag });
  const pool = biome.creatures;
  const normalPool = pool.filter((c) => c !== "stalker" && c !== "guardian");
  for (const r of rooms) {
    if (r.kind === "start") continue;
    if (r.kind === "boss") {
      addSpawn(biome.boss, { x: r.cx, y: r.cy }, r.id, true);
      for (let i = 0; i < 2; i++) { const p = freeTile(r); if (p) addSpawn(rng.pick(normalPool.length ? normalPool : pool), p, r.id); }
      continue;
    }
    const n = r.kind === "hidden" ? 1 : rng.int(1, 2) + (biome.danger >= 2 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const p = freeTile(r);
      if (!p) continue;
      let cid: CreatureId = rng.pick(normalPool.length ? normalPool : pool) as CreatureId;
      if (r.dark && pool.includes("stalker")) cid = "stalker";
      addSpawn(cid, p, r.id);
    }
  }
  if (pool.includes("guardian")) {
    for (const d of mine.deposits.slice()) {
      if (d.res && (d.res === "blueCrystal" || d.res === "emerald") && rng.chance(0.28)) {
        const room = rooms[d.room];
        const p = freeTile(room);
        if (p) addSpawn("guardian", p, d.room);
      }
    }
  }

  /* -------- hazards -------- */
  const addHaz = (type: Hazard["type"], p: Pt, r: number) => mine.hazards.push({ id: mine.hazards.length, type, x: tileCenter(p.x), z: tileCenter(p.y), r });
  for (const r of rooms) {
    if (r.kind === "start" || r.kind === "boss") continue;
    if (!rng.chance(0.65)) continue;
    const type = rng.pick(biome.hazards);
    for (let tries = 0; tries < 20; tries++) {
      const x = rng.int(r.x + 1, r.x + r.w - 2), y = rng.int(r.y + 1, r.y + r.h - 2);
      if (tiles[y * TW + x] !== 1) continue;
      if (Math.abs(x - r.cx) < 3 && Math.abs(y - r.cy) < 3) continue;
      if (type === "gas") addHaz("gas", { x, y }, 2.8);
      else if (type === "lava") addHaz("lava", { x, y }, 2.3);
      else if (type === "heat") addHaz("heat", { x: r.cx, y: r.cy }, 6.5);
      else if (type === "trap") addHaz("trap", { x, y }, 1.3);
      else addHaz("water", { x, y }, 2.4);
      break;
    }
  }

  /* -------- props (decor only, non-colliding) -------- */
  for (const r of rooms) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const edge = rng.int(0, 3);
      const x = edge === 0 ? r.x + 1 : edge === 1 ? r.x + r.w - 2 : rng.int(r.x + 1, r.x + r.w - 2);
      const y = edge === 2 ? r.y + 1 : edge === 3 ? r.y + r.h - 2 : rng.int(r.y + 1, r.y + r.h - 2);
      if (tiles[y * TW + x] !== 1 || blocked[y * TW + x]) continue;
      mine.props.push({ kind: rng.pick(biome.props), x: tileCenter(x), z: tileCenter(y), rot: rng.next() * 6.28, scale: 0.8 + rng.next() * 0.6 });
    }
  }

  mine.valid = validateConnectivity(mine, hiddenIds, blocked);
  return mine;
}

function validateConnectivity(mine: Mine, hiddenIds: number[], blocked?: Uint8Array): boolean {
  const sx = toTile(mine.start.x), sy = toTile(mine.start.z);
  if (mine.tiles[sy * TW + sx] !== 1) return false;
  const all = bfs(mine.tiles, sx, sy, true, blocked);
  const plain = bfs(mine.tiles, sx, sy, false, blocked);
  for (const r of mine.rooms) {
    const i = r.cy * TW + r.cx;
    if (!all[i]) return false;
    if (r.kind === "hidden" || hiddenIds.includes(r.id)) { if (plain[i]) return false; }
    else if (!plain[i]) return false;
  }
  for (const e of mine.exits) if (!plain[toTile(e.z) * TW + toTile(e.x)]) return false;
  return true;
}

/** Public entry. Deterministic. Retries with attempt salts until a valid layout is produced. */
export function generateMine(seed: number, biome: number): Mine {
  let last: Mine | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const hidden = attempt < 20 ? (biome >= 1 ? 2 : 1) : 0;
    const m = build(seed >>> 0, biome, attempt, hidden);
    last = m;
    if (m.valid) return m;
  }
  return last as Mine;
}

export const creatureDef = (id: string) => CREATURES[id];
