"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BIOMES, RESOURCES } from "../game/config";
import { Rng, hash2, type ExitPoint, type Hazard, type Prop } from "../game/gen";
import type { DepState, Expedition } from "../game/engine";

const GEO = {
  ico: new THREE.IcosahedronGeometry(0.8, 1),
  ico0: new THREE.IcosahedronGeometry(0.5, 0),
  dodeca: new THREE.DodecahedronGeometry(0.16, 0),
  cone6: new THREE.ConeGeometry(0.2, 1, 6),
  octa: new THREE.OctahedronGeometry(0.3, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
  disc: new THREE.CircleGeometry(1, 28),
  sph: new THREE.SphereGeometry(1, 10, 8),
};

function useCull(ref: React.RefObject<THREE.Object3D | null>, eng: Expedition, x: number, z: number, r = 55) {
  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = Math.abs(eng.p.x - x) < r && Math.abs(eng.p.z - z) < r;
  });
}

/* ------------------------------ deposits ------------------------------ */
export function DepositMesh({ ds, eng, biome }: { ds: DepState; eng: Expedition; biome: number }) {
  const d = ds.d;
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const def = d.res ? RESOURCES[d.res] : null;
  const bdef = BIOMES[biome];
  const layout = useMemo(() => {
    const r = new Rng(hash2(d.id, 99));
    return Array.from({ length: 7 }, () => ({ a: r.next() * 6.283, h: 0.3 + r.next() * 0.6, s: 0.7 + r.next() * 0.8, t: 0.15 + r.next() * 0.5, o: r.next() }));
  }, [d.id]);
  useFrame((st) => {
    const g = root.current; if (!g) return;
    g.visible = ds.alive && Math.abs(eng.p.x - d.x) < 55 && Math.abs(eng.p.z - d.z) < 55;
    if (!inner.current) return;
    const ratio = Math.max(0.05, ds.hp / d.durability);
    const sc = d.kind === "secret" ? 1 : (0.6 + 0.4 * ratio) * d.scale;
    const shake = ds.hit > 0 ? Math.sin(st.clock.elapsedTime * 80) * 0.06 : 0;
    inner.current.scale.setScalar(sc);
    inner.current.position.x = shake;
    inner.current.rotation.y = d.rot;
    if (def && (def.kind === "relic")) inner.current.children[1] && (inner.current.children[1].position.y = 1.4 + Math.sin(st.clock.elapsedTime * 1.5) * 0.15);
  });
  if (d.kind === "secret") {
    return (
      <group ref={root} position={[d.x, 0, d.z]}>
        <group ref={inner}>
          <mesh position={[0, 1.6, 0]} castShadow receiveShadow><boxGeometry args={[5.9, 3.2, 5.9]} /><meshStandardMaterial color={new THREE.Color(bdef.wall).offsetHSL(0, 0, 0.08)} roughness={1} flatShading /></mesh>
          {[[-1.2, 0.2, 2.2, 0.2], [0.8, -0.5, 2.6, -0.4], [1.8, 1.5, 1.8, 0.8], [-2, -1.4, 1.4, 0.1]].map(([x, z, l, r], i) => (
            <mesh key={i} position={[x, 3.22, z]} rotation={[0, r, 0]}><boxGeometry args={[0.12, 0.02, l]} /><meshStandardMaterial color={bdef.accent} emissive={bdef.accent} emissiveIntensity={2.2} /></mesh>
          ))}
          <mesh position={[0, 0.5, 2.95]}><boxGeometry args={[3.5, 0.06, 0.04]} /><meshStandardMaterial color={bdef.accent} emissive={bdef.accent} emissiveIntensity={2} /></mesh>
        </group>
      </group>
    );
  }
  const col = def!.color, glow = def!.glow;
  const stone = new THREE.Color(bdef.wall).offsetHSL(0, 0, 0.12);
  return (
    <group ref={root} position={[d.x, 0, d.z]}>
      <group ref={inner}>
        {(def!.kind === "ore" || def!.kind === "ingot") && (
          <>
            <mesh geometry={GEO.ico} position={[0, 0.5, 0]} scale={[1, 0.75, 0.9]} castShadow><meshStandardMaterial color={d.res === "stone" ? "#8a8680" : d.res === "coal" ? "#34302e" : stone} roughness={0.95} flatShading /></mesh>
            {d.res !== "stone" && layout.map((l, i) => (
              <mesh key={i} geometry={GEO.dodeca} position={[Math.cos(l.a) * 0.62, 0.35 + l.h * 0.8, Math.sin(l.a) * 0.55]} scale={l.s * 1.4}>
                <meshStandardMaterial color={col} emissive={col} emissiveIntensity={glow * 1.2} metalness={d.res === "coal" ? 0.1 : 0.7} roughness={d.res === "coal" ? 0.4 : 0.3} flatShading />
              </mesh>
            ))}
            {d.res === "stone" && <mesh geometry={GEO.ico0} position={[0.7, 0.3, 0.2]} scale={0.8}><meshStandardMaterial color="#7a766f" roughness={1} flatShading /></mesh>}
          </>
        )}
        {def!.kind === "crystal" && (
          <>
            <mesh geometry={GEO.ico0} position={[0, 0.2, 0]} scale={[1.3, 0.6, 1.3]}><meshStandardMaterial color={stone} roughness={1} flatShading /></mesh>
            {layout.map((l, i) => (
              <mesh key={i} geometry={GEO.cone6} position={[Math.cos(l.a) * l.t * 1.2, 0.35 + l.h * 0.6, Math.sin(l.a) * l.t * 1.2]} rotation={[Math.sin(l.a) * 0.4, 0, -Math.cos(l.a) * 0.4]} scale={[l.s * 0.9, 0.8 + l.h * 2.2, l.s * 0.9]}>
                <meshStandardMaterial color={col} emissive={col} emissiveIntensity={glow * 0.9} transparent opacity={0.92} roughness={0.15} metalness={0.3} flatShading />
              </mesh>
            ))}
          </>
        )}
        {def!.kind === "gem" && (
          <>
            <mesh geometry={GEO.ico} position={[0, 0.3, 0]} scale={[1, 0.5, 0.9]}><meshStandardMaterial color={stone} roughness={1} flatShading /></mesh>
            {layout.slice(0, 4).map((l, i) => (
              <mesh key={i} geometry={GEO.octa} position={[Math.cos(l.a) * 0.4, 0.7 + l.h * 0.4, Math.sin(l.a) * 0.4]} rotation={[l.a, l.a * 2, 0]} scale={[l.s * 1.2, l.s * 1.9, l.s * 1.2]}>
                <meshStandardMaterial color={col} emissive={col} emissiveIntensity={glow * 0.9} roughness={0.05} metalness={0.6} flatShading />
              </mesh>
            ))}
          </>
        )}
        {def!.kind === "relic" && (
          <>
            <mesh geometry={GEO.cyl} position={[0, 0.35, 0]} scale={[0.7, 0.7, 0.7]}><meshStandardMaterial color="#5a5648" roughness={0.8} /></mesh>
            <mesh geometry={GEO.octa} position={[0, 1.4, 0]} scale={[1.6, 2.2, 1.6]}><meshStandardMaterial color={col} emissive={col} emissiveIntensity={glow} metalness={0.8} roughness={0.2} flatShading /></mesh>
            <mesh position={[0, 1.4, 0]} rotation={[1.2, 0, 0]}><torusGeometry args={[0.65, 0.04, 6, 24]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.6} /></mesh>
          </>
        )}
      </group>
    </group>
  );
}

/* ------------------------------ props ------------------------------ */
export function PropMesh({ p, eng, biome }: { p: Prop; eng: Expedition; biome: number }) {
  const root = useRef<THREE.Group>(null);
  const shard = useRef<THREE.Mesh>(null);
  useCull(root, eng, p.x, p.z, 50);
  const b = BIOMES[biome];
  useFrame((st) => { if (shard.current) { shard.current.position.y = 1.2 + Math.sin(st.clock.elapsedTime + p.x) * 0.2; shard.current.rotation.y += 0.01; } });
  const wood = "#5a3d22";
  let body: React.ReactNode = null;
  switch (p.kind) {
    case "beam":
      body = (<>
        <mesh geometry={GEO.box} position={[-1.2, 1.5, 0]} scale={[0.25, 3, 0.25]} castShadow><meshStandardMaterial color={wood} roughness={1} /></mesh>
        <mesh geometry={GEO.box} position={[1.2, 1.5, 0]} scale={[0.25, 3, 0.25]} castShadow><meshStandardMaterial color={wood} roughness={1} /></mesh>
        <mesh geometry={GEO.box} position={[0, 3, 0]} scale={[2.9, 0.28, 0.3]} castShadow><meshStandardMaterial color={wood} roughness={1} /></mesh>
      </>); break;
    case "cart":
      body = (<>
        <mesh geometry={GEO.box} position={[0, 0.55, 0]} scale={[1.5, 0.7, 0.9]} castShadow><meshStandardMaterial color="#6b4a2e" roughness={0.9} metalness={0.3} /></mesh>
        {[[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.45], [0.5, -0.45]].map(([x, z], i) => <mesh key={i} geometry={GEO.cyl} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.2, 0.08, 0.2]}><meshStandardMaterial color="#222" metalness={0.8} /></mesh>)}
        <mesh geometry={GEO.ico0} position={[0, 1, 0]} scale={0.8}><meshStandardMaterial color="#26221f" roughness={0.9} flatShading /></mesh>
      </>); break;
    case "barrel":
      body = (<><mesh geometry={GEO.cyl} position={[0, 0.5, 0]} scale={[0.4, 1, 0.4]} castShadow><meshStandardMaterial color="#6e4a28" roughness={0.9} /></mesh><mesh geometry={GEO.cyl} position={[0, 0.7, 0]} scale={[0.43, 0.06, 0.43]}><meshStandardMaterial color="#222" metalness={0.8} /></mesh></>); break;
    case "rockpile":
      body = (<>{[0, 1, 2].map((i) => <mesh key={i} geometry={GEO.ico0} position={[i * 0.5 - 0.5, 0.3, (i % 2) * 0.4]} scale={0.6 + i * 0.25} castShadow><meshStandardMaterial color={new THREE.Color(b.wall).offsetHSL(0, 0, 0.05 * i)} roughness={1} flatShading /></mesh>)}</>); break;
    case "crystal":
      body = (<>{[0, 1, 2, 3].map((i) => <mesh key={i} geometry={GEO.cone6} position={[Math.cos(i * 1.7) * 0.5, 0.8, Math.sin(i * 1.7) * 0.5]} rotation={[Math.sin(i) * 0.3, 0, Math.cos(i) * 0.3]} scale={[1.2, 2.4 + i * 0.6, 1.2]}><meshStandardMaterial color={b.accent} emissive={b.accent} emissiveIntensity={1.1} transparent opacity={0.85} roughness={0.1} flatShading /></mesh>)}</>); break;
    case "pillar":
      body = (<>
        <mesh geometry={GEO.cyl} position={[0, 1.6, 0]} scale={[0.5, 3.2, 0.5]} castShadow><meshStandardMaterial color="#6b6850" roughness={0.9} /></mesh>
        <mesh geometry={GEO.box} position={[0, 0.15, 0]} scale={[1.3, 0.3, 1.3]}><meshStandardMaterial color="#55533f" roughness={1} /></mesh>
        <mesh geometry={GEO.box} position={[0, 1.8, 0.51]} scale={[0.08, 1.2, 0.02]}><meshStandardMaterial color={b.accent} emissive={b.accent} emissiveIntensity={2} /></mesh>
      </>); break;
    case "shard":
      body = (<mesh ref={shard} geometry={GEO.octa} scale={[1, 2.4, 1]}><meshStandardMaterial color={b.accent} emissive={b.accent} emissiveIntensity={1.6} roughness={0.1} flatShading /></mesh>); break;
    case "lavarock":
      body = (<><mesh geometry={GEO.ico} position={[0, 0.5, 0]} scale={[0.9, 0.7, 0.9]} castShadow><meshStandardMaterial color="#1e0f0b" roughness={1} flatShading /></mesh><mesh geometry={GEO.ico0} position={[0.3, 0.7, 0.2]} scale={0.35}><meshStandardMaterial color="#ff6a2a" emissive="#ff5a1e" emissiveIntensity={2} /></mesh></>); break;
  }
  return <group ref={root} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>{body}</group>;
}

/* ------------------------------ hazards ------------------------------ */
export function HazardMesh({ h, eng }: { h: Hazard; eng: Expedition }) {
  const root = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const spikes = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.Group>(null);
  useCull(root, eng, h.x, h.z, 50);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (mat.current && h.type === "lava") mat.current.emissiveIntensity = 1.6 + Math.sin(t * 2 + h.id) * 0.5;
    if (spikes.current) {
      const ph = (eng.time + h.id * 0.7) % 3;
      const up = ph < 0.6 ? 1 : ph > 2.4 ? (ph - 2.4) / 0.6 * 0.35 : 0.1;
      spikes.current.scale.y = Math.max(0.05, up);
    }
    if (puffs.current) puffs.current.children.forEach((c, i) => { c.position.y = 0.8 + Math.sin(t * 0.8 + i * 2) * 0.35; c.position.x = Math.cos(t * 0.3 + i) * h.r * 0.45; c.position.z = Math.sin(t * 0.25 + i * 1.7) * h.r * 0.45; });
  });
  return (
    <group ref={root} position={[h.x, 0, h.z]}>
      {h.type === "lava" && <mesh geometry={GEO.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={h.r}><meshStandardMaterial ref={mat} color="#ff4a10" emissive="#ff5a1e" emissiveIntensity={1.8} roughness={0.5} /></mesh>}
      {h.type === "lava" && <mesh geometry={GEO.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={h.r * 1.25}><meshStandardMaterial color="#1a0a06" roughness={1} /></mesh>}
      {h.type === "water" && <mesh geometry={GEO.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={h.r}><meshStandardMaterial color="#1b4a78" metalness={0.9} roughness={0.08} transparent opacity={0.85} /></mesh>}
      {h.type === "heat" && <mesh geometry={GEO.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={h.r}><meshBasicMaterial color="#ff5a1e" transparent opacity={0.07} depthWrite={false} /></mesh>}
      {h.type === "gas" && (
        <>
          <mesh geometry={GEO.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={h.r}><meshBasicMaterial color="#7dff5a" transparent opacity={0.12} depthWrite={false} /></mesh>
          <group ref={puffs}>{[0, 1, 2, 3, 4].map((i) => <mesh key={i} geometry={GEO.sph} scale={0.9 + (i % 3) * 0.3}><meshBasicMaterial color="#8cff6a" transparent opacity={0.16} depthWrite={false} /></mesh>)}</group>
        </>
      )}
      {h.type === "trap" && (
        <>
          <mesh geometry={GEO.cyl} position={[0, 0.04, 0]} scale={[h.r, 0.08, h.r]}><meshStandardMaterial color="#3a3a2c" metalness={0.7} roughness={0.5} /></mesh>
          <group ref={spikes}>{[[0, 0], [0.5, 0.3], [-0.5, 0.3], [0.3, -0.5], [-0.3, -0.5]].map(([x, z], i) => <mesh key={i} geometry={GEO.cone6} position={[x * h.r * 0.8, 0.5, z * h.r * 0.8]} scale={[0.6, 1.1, 0.6]}><meshStandardMaterial color="#c9d2da" metalness={1} roughness={0.2} emissive="#ff3a3a" emissiveIntensity={0.3} /></mesh>)}</group>
        </>
      )}
    </group>
  );
}

/* ------------------------------ exits / lost pack ------------------------------ */
export function ExitMesh({ x, exit, eng, index }: { x: number; exit: ExitPoint; eng: Expedition; index: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const el = exit.kind === "elevator";
  const col = el ? "#ffb45a" : "#4fffd8";
  useFrame((st) => {
    const near = Math.hypot(exit.x - eng.p.x, exit.z - eng.p.z) < 3.4;
    if (ring.current) { ring.current.rotation.z += 0.02; ring.current.scale.setScalar(1 + (near ? eng.extractT * 0.25 : 0) + Math.sin(st.clock.elapsedTime * 3) * 0.03); }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = (eng.exitFound[index] ? 0.16 : 0.05) + (near ? eng.extractT * 0.2 : 0);
  });
  void x;
  return (
    <group position={[exit.x, 0, exit.z]}>
      <mesh geometry={GEO.cyl} position={[0, 0.06, 0]} scale={[2.3, 0.12, 2.3]} receiveShadow><meshStandardMaterial color="#2d2d33" metalness={0.8} roughness={0.4} /></mesh>
      <mesh ref={ring} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[1.9, 0.07, 8, 32]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={2.2} /></mesh>
      {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([px, pz], i) => <mesh key={i} geometry={GEO.box} position={[px, 1.6, pz]} scale={[0.18, 3.2, 0.18]} castShadow><meshStandardMaterial color="#4a4a52" metalness={0.8} roughness={0.4} /></mesh>)}
      {[[0, -2], [0, 2]].map(([bx, bz], i) => <mesh key={"bx" + i} geometry={GEO.box} position={[bx, 3.2, bz]} scale={[4.3, 0.18, 0.18]}><meshStandardMaterial color="#3a3a42" metalness={0.8} roughness={0.5} /></mesh>)}
      {[[-2, 0], [2, 0]].map(([bx, bz], i) => <mesh key={"bz" + i} geometry={GEO.box} position={[bx, 3.2, bz]} scale={[0.18, 0.18, 4.3]}><meshStandardMaterial color="#3a3a42" metalness={0.8} roughness={0.5} /></mesh>)}
      <mesh geometry={GEO.sph} position={[0, 3.0, 0]} scale={0.22}><meshStandardMaterial color={col} emissive={col} emissiveIntensity={3} /></mesh>
      <mesh ref={beam} geometry={GEO.cyl} position={[0, 1.6, 0]} scale={[1.8, 3.2, 1.8]}><meshBasicMaterial color={col} transparent opacity={0.12} depthWrite={false} /></mesh>
    </group>
  );
}

export function LostPackMesh({ eng }: { eng: Expedition }) {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    const lp = eng.lostPack;
    if (!g.current) return;
    g.current.visible = !!lp && !lp.taken;
    if (lp) { g.current.position.set(lp.x, 0.5 + Math.sin(st.clock.elapsedTime * 2) * 0.12, lp.z); g.current.rotation.y += 0.02; }
  });
  return (
    <group ref={g} visible={false}>
      <mesh geometry={GEO.box} scale={[0.8, 0.7, 0.5]} castShadow><meshStandardMaterial color="#8a5a2a" roughness={0.9} /></mesh>
      <mesh geometry={GEO.box} position={[0, 0.4, 0]} scale={[0.85, 0.12, 0.55]}><meshStandardMaterial color="#e0b04a" emissive="#ffb938" emissiveIntensity={1.5} /></mesh>
      <mesh position={[0, 1.3, 0]} geometry={GEO.cone6} scale={[0.5, 2.2, 0.5]} rotation={[Math.PI, 0, 0]}><meshBasicMaterial color="#ffd36a" transparent opacity={0.45} /></mesh>
    </group>
  );
}
