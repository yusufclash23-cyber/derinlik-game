"use client";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BIOMES } from "../game/config";
import { TH, TILE, TW, hash2, toTile } from "../game/gen";
import type { Expedition } from "../game/engine";

const CH = 14; // tiles per chunk (== generator cell)
const CHX = Math.ceil(TW / CH), CHZ = Math.ceil(TH / CH);

interface Item { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry?: number; rx?: number; c: THREE.Color }

const FLOOR_GEO = new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2);
const BOX_GEO = new THREE.BoxGeometry(TILE, 1, TILE).translate(0, 0.5, 0);
const ROCK_GEO = new THREE.IcosahedronGeometry(1, 1);

function Inst({ geo, items, shadows }: { geo: THREE.BufferGeometry; items: Item[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.scale.set(it.sx, it.sy, it.sz);
      o.rotation.set(it.rx ?? 0, it.ry ?? 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, it.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return (
    <instancedMesh key={items.length} ref={ref} args={[geo, undefined, items.length]} frustumCulled={false} castShadow={shadows} receiveShadow={shadows}>
      <meshStandardMaterial roughness={1} metalness={0} flatShading />
    </instancedMesh>
  );
}

const Chunk = memo(function Chunk({ eng, cx, cz, biome, version, shadows }: { eng: Expedition; cx: number; cz: number; biome: number; version: number; shadows: boolean }) {
  void version;
  const { floors, walls, rocks } = useMemo(() => {
    const b = BIOMES[biome];
    const wallC = new THREE.Color(b.wall), floorC = new THREE.Color(b.floor);
    const tiles = eng.tiles;
    const at = (x: number, z: number) => (x < 0 || z < 0 || x >= TW || z >= TH ? 0 : tiles[z * TW + x]);
    const floors: Item[] = [], walls: Item[] = [], rocks: Item[] = [];
    for (let tz = cz * CH; tz < Math.min(TH, (cz + 1) * CH); tz++) for (let tx = cx * CH; tx < Math.min(TW, (cx + 1) * CH); tx++) {
      const v = at(tx, tz);
      const n = (hash2(tx * 31 + 7, tz * 17 + 3) % 1000) / 1000;
      const x = (tx + 0.5) * TILE, z = (tz + 0.5) * TILE;
      if (v !== 0) {
        floors.push({ x, y: 0, z, sx: 1, sy: 1, sz: 1, c: floorC.clone().offsetHSL(0, 0, (n - 0.5) * 0.05) });
        continue;
      }
      let edge = false;
      for (let dz = -1; dz <= 1 && !edge; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && at(tx + dx, tz + dz) !== 0) { edge = true; break; }
      const h = edge ? 2.6 + n * 1.0 : 2.0;
      walls.push({ x, y: 0, z, sx: 1, sy: h, sz: 1, c: wallC.clone().offsetHSL(0, 0, (n - 0.5) * 0.07) });
      if (edge) {
        // boulders on the floor-facing side give the cave wall a rugged silhouette
        let fx = 0, fz = 0;
        if (at(tx - 1, tz)) fx -= 1; if (at(tx + 1, tz)) fx += 1; if (at(tx, tz - 1)) fz -= 1; if (at(tx, tz + 1)) fz += 1;
        const s = 0.7 + ((hash2(tx, tz) % 100) / 100) * 0.6;
        rocks.push({ x: x + fx * 0.55, y: 0.5 + n * 1.6, z: z + fz * 0.55, sx: s, sy: s * 1.1, sz: s, ry: n * 6, rx: n * 3, c: wallC.clone().offsetHSL(0, 0, 0.03 + n * 0.06) });
      }
    }
    return { floors, walls, rocks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cx, cz, biome, version]);
  return (
    <group>
      <Inst geo={FLOOR_GEO} items={floors} shadows={shadows} />
      <Inst geo={BOX_GEO} items={walls} shadows={shadows} />
      <Inst geo={ROCK_GEO} items={rocks} shadows={shadows} />
    </group>
  );
});

/** Streams terrain chunks in/out around the player (progressive loading, auto-disposed on unmount). */
export function Terrain({ eng, biome, version, shadows }: { eng: Expedition; biome: number; version: number; shadows: boolean }) {
  const [c, setC] = useState({ x: Math.floor(toTile(eng.p.x) / CH), z: Math.floor(toTile(eng.p.z) / CH) });
  useFrame(() => {
    const x = Math.floor(toTile(eng.p.x) / CH), z = Math.floor(toTile(eng.p.z) / CH);
    if (x !== c.x || z !== c.z) setC({ x, z });
  });
  const list: { x: number; z: number }[] = [];
  for (let z = c.z - 1; z <= c.z + 1; z++) for (let x = c.x - 1; x <= c.x + 1; x++) if (x >= 0 && z >= 0 && x < CHX && z < CHZ) list.push({ x, z });
  return <>{list.map((k) => <Chunk key={`${k.x},${k.z}`} eng={eng} cx={k.x} cz={k.z} biome={biome} version={version} shadows={shadows} />)}</>;
}
