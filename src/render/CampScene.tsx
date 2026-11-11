"use client";
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";
import { BUILDINGS, BUILDING_IDS, type BuildingId, type Slot } from "../game/config";
import type { Save } from "../game/economy";
import type { Lang } from "../game/i18n";
import { Explorer, newAnim } from "./Explorer";
import type { Quality } from "./MineScene";

const POS: Record<BuildingId, [number, number, number]> = {
  hq: [0, 0, -12.5], workshop: [-5, 0, -9], furnace: [5, 0, -9], lab: [-9, 0, -4], medical: [9, 0, -4],
  warehouse: [-9, 0, 4.5], trading: [9, 0, 4.5], elevator: [0, 0, -5.5],
};
const ROT: Record<BuildingId, number> = { hq: 0, workshop: 0.35, furnace: -0.35, lab: 0.9, medical: -0.9, warehouse: 1.9, trading: -1.9, elevator: 0 };
const WOOD = "#6b4a2a", STONE = "#6e665c", METAL = "#5a606a";

function Mat({ c, m = 0.1, r = 0.85, e, ei = 0 }: { c: string; m?: number; r?: number; e?: string; ei?: number }) {
  return <meshStandardMaterial color={c} metalness={m} roughness={r} emissive={e ?? "#000"} emissiveIntensity={ei} />;
}
const Box = ({ p, s, c, m, e, ei, r }: { p: [number, number, number]; s: [number, number, number]; c: string; m?: number; e?: string; ei?: number; r?: number }) => (
  <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><Mat c={c} m={m} e={e} ei={ei} r={r} /></mesh>
);

function Model({ id, L }: { id: BuildingId; L: number }) {
  const spin = useRef<THREE.Mesh>(null);
  const smoke = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (spin.current) spin.current.rotation.z += 0.02;
    if (smoke.current) smoke.current.children.forEach((c, i) => { const k = (t * 0.5 + i / 4) % 1; c.position.y = 3.6 + k * 3; c.scale.setScalar(0.3 + k * 0.7); ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k); });
    if (lift.current) lift.current.position.y = 0.3 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 0.8;
  });
  if (L === 0) {
    return (
      <group>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[4, 2.4, 3.4]} /><meshBasicMaterial color="#ffd36a" wireframe transparent opacity={0.45} /></mesh>
        {[[-2, -1.7], [2, -1.7], [-2, 1.7], [2, 1.7]].map(([x, z], i) => <Box key={i} p={[x, 1.2, z]} s={[0.12, 2.4, 0.12]} c={WOOD} />)}
      </group>
    );
  }
  switch (id) {
    case "hq":
      return (
        <group>
          {Array.from({ length: Math.min(L, 5) }, (_, i) => <Box key={i} p={[0, 1.2 + i * 1.5, 0]} s={[5 - i * 0.5, 1.5, 4 - i * 0.4]} c={i % 2 ? "#7b6a55" : "#8a7960"} />)}
          {Array.from({ length: Math.min(L, 5) * 2 }, (_, i) => <Box key={"w" + i} p={[-1.6 + (i % 2) * 3.2, 1.3 + Math.floor(i / 2) * 1.5, 2.05 - Math.floor(i / 2) * 0.2]} s={[0.6, 0.6, 0.05]} c="#ffd98a" e="#ffb84a" ei={1.8} />)}
          <mesh position={[0, 1.2 + Math.min(L, 5) * 1.5 + 0.7, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[3, 1.6, 4]} /><Mat c="#5a2f22" r={0.9} /></mesh>
          <mesh position={[2.2, 4 + L, -1]}><cylinderGeometry args={[0.05, 0.05, 3, 6]} /><Mat c="#ccc" m={0.8} /></mesh>
          <Box p={[2.65, 5 + L * 1, -1]} s={[0.9, 0.55, 0.04]} c="#e8751a" e="#e8751a" ei={0.5} />
          <mesh position={[0, 0.75, 2.1]}><boxGeometry args={[0.9, 1.5, 0.1]} /><Mat c="#3b2a1a" /></mesh>
        </group>
      );
    case "workshop":
      return (
        <group>
          <Box p={[0, 1, 0]} s={[4, 2, 3]} c="#7a6248" />
          <mesh position={[0, 2.35, 0]} rotation={[0, 0, 0]} castShadow><boxGeometry args={[4.4, 0.25, 3.5]} /><Mat c="#4a3a2c" /></mesh>
          <Box p={[-1.5, 0.4, 2]} s={[0.9, 0.8, 0.5]} c="#3a3f48" m={0.8} />
          <mesh ref={spin} position={[1.4, 1.5, 1.55]}><torusGeometry args={[0.45, 0.12, 6, 10]} /><Mat c="#c9a24a" m={0.9} r={0.3} /></mesh>
          {L >= 2 && <Box p={[2.5, 2.6, 0]} s={[0.2, 3.4, 0.2]} c={METAL} m={0.8} />}
          {L >= 2 && <Box p={[1.2, 4.2, 0]} s={[2.8, 0.2, 0.2]} c={METAL} m={0.8} />}
          {L >= 3 && <mesh position={[0, 2.9, 0]}><sphereGeometry args={[0.35, 10, 8]} /><Mat c="#6fe3ff" e="#6fe3ff" ei={2.5} /></mesh>}
          {L >= 4 && <Box p={[-2.4, 1.4, 0]} s={[0.6, 2.8, 0.6]} c="#3a3f48" m={0.9} e="#ffb04a" ei={0.6} />}
        </group>
      );
    case "furnace":
      return (
        <group>
          <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[1.5, 1.8, 2.8, 10]} /><Mat c={STONE} r={1} /></mesh>
          <mesh position={[0, 3.2, 0]} castShadow><cylinderGeometry args={[0.55, 0.8, 2, 8]} /><Mat c="#59524a" r={1} /></mesh>
          <mesh position={[0, 0.9, 1.6]}><boxGeometry args={[1.2, 0.9, 0.3]} /><Mat c="#ff7a1e" e="#ff5a1e" ei={2.5 + L * 0.4} /></mesh>
          <group ref={smoke}>{[0, 1, 2, 3].map((i) => <mesh key={i} position={[0, 4, 0]}><sphereGeometry args={[0.6, 8, 6]} /><meshBasicMaterial color="#777" transparent opacity={0.3} depthWrite={false} /></mesh>)}</group>
          {L >= 2 && <Box p={[2.2, 0.6, 0.5]} s={[1, 1.2, 1]} c="#3a3f48" m={0.8} />}
          {L >= 3 && <Box p={[-2.2, 0.8, 0.5]} s={[1.2, 1.6, 1.2]} c="#8a5a2a" m={0.6} e="#ffb04a" ei={0.6} />}
        </group>
      );
    case "warehouse":
      return (
        <group>
          <Box p={[0, 1.3, 0]} s={[5.4, 2.6, 3.4]} c="#5e564a" />
          <mesh position={[0, 3.0, 0]} rotation={[0, 0, Math.PI / 4]} castShadow><boxGeometry args={[2.1, 2.1, 3.6]} /><Mat c="#3b3a40" m={0.5} /></mesh>
          <Box p={[0, 0.9, 1.75]} s={[1.8, 1.8, 0.1]} c="#2a2018" />
          {Array.from({ length: L * 2 }, (_, i) => <Box key={i} p={[-3.2 - (i % 2) * 0.1, 0.4 + Math.floor(i / 2) * 0.8, 1 - (i % 2) * 1.1]} s={[0.9, 0.75, 0.9]} c="#9a6a34" />)}
        </group>
      );
    case "lab":
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[2.3, 2.5, 1, 12]} /><Mat c="#59606a" m={0.5} r={0.6} /></mesh>
          <mesh position={[0, 1, 0]} castShadow><sphereGeometry args={[2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color="#9fd8ff" transparent opacity={0.35} roughness={0.05} metalness={0.2} /></mesh>
          <mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.5 + L * 0.1, 14, 10]} /><Mat c="#8affd4" e="#46ffc0" ei={2.4} /></mesh>
          <mesh ref={spin} position={[0, 1.4, 0]} rotation={[Math.PI / 2.4, 0, 0]}><torusGeometry args={[1.1 + L * 0.1, 0.05, 6, 28]} /><Mat c="#6fe3ff" e="#6fe3ff" ei={2} /></mesh>
          <Box p={[2.4, 1.5, 0]} s={[0.1, 3, 0.1]} c="#ccc" m={0.8} />
        </group>
      );
    case "trading":
      return (
        <group>
          <Box p={[0, 0.5, 0]} s={[3.6, 1, 1.6]} c="#7a5a36" />
          {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[-1.5 + i * 0.6, 2.6, 0.2]} s={[0.6, 0.12, 2.2]} c={i % 2 ? "#e8e0d0" : "#c2304a"} />)}
          {[-1.7, 1.7].map((x) => <Box key={x} p={[x, 1.3, 1]} s={[0.12, 2.6, 0.12]} c={WOOD} />)}
          {Array.from({ length: 2 + L * 2 }, (_, i) => <mesh key={i} position={[-1 + (i % 4) * 0.35, 1.05 + Math.floor(i / 4) * 0.1, 0]}><cylinderGeometry args={[0.14, 0.14, 0.08, 10]} /><Mat c="#ffc93c" m={0.9} r={0.3} e="#ffb000" ei={0.3} /></mesh>)}
          <mesh position={[1.2, 1.4, 0.3]}><sphereGeometry args={[0.15, 8, 8]} /><Mat c="#ffe9b8" e="#ffd27a" ei={3} /></mesh>
        </group>
      );
    case "elevator":
      return (
        <group>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.4, 20]} /><meshBasicMaterial color="#050403" /></mesh>
          {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z], i) => <Box key={i} p={[x, 2.2, z]} s={[0.22, 4.4, 0.22]} c={METAL} m={0.8} />)}
          <Box p={[0, 4.4, 0]} s={[4.6, 0.3, 4.6]} c="#3a3f48" m={0.8} />
          <group ref={lift}><Box p={[0, 0, 0]} s={[3.2, 0.2, 3.2]} c="#6b5a3a" m={0.6} /></group>
          <mesh position={[0, 3.9, 0]}><sphereGeometry args={[0.28, 10, 8]} /><Mat c="#ffb45a" e="#ffb45a" ei={3} /></mesh>
          {Array.from({ length: L }, (_, i) => <mesh key={i} position={[-2 + i * 1, 4.75, -2]}><sphereGeometry args={[0.14, 8, 8]} /><Mat c="#4fffd8" e="#4fffd8" ei={3} /></mesh>)}
        </group>
      );
    case "medical":
      return (
        <group>
          <Box p={[0, 1.1, 0]} s={[3.6, 2.2, 3]} c="#e4e0d6" />
          <Box p={[0, 2.3, 0]} s={[3.9, 0.2, 3.3]} c="#9a2a2a" />
          <Box p={[0, 1.4, 1.52]} s={[1.2, 0.34, 0.06]} c="#ff3355" e="#ff3355" ei={1.5} />
          <Box p={[0, 1.4, 1.52]} s={[0.34, 1.2, 0.06]} c="#ff3355" e="#ff3355" ei={1.5} />
          <mesh position={[1.6, 2.7, 1.3]}><sphereGeometry args={[0.18, 8, 8]} /><Mat c="#6fff9a" e="#6fff9a" ei={3} /></mesh>
          {L >= 2 && <Box p={[2.4, 0.5, 0.5]} s={[0.9, 1, 1.4]} c="#d8d2c4" />}
          {L >= 3 && <Box p={[-2.4, 0.5, 0.5]} s={[0.9, 1, 1.4]} c="#d8d2c4" />}
        </group>
      );
  }
}

function Building({ id, level, lang, onSelect }: { id: BuildingId; level: number; lang: Lang; onSelect: (id: BuildingId) => void }) {
  const g = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, dt) => { if (g.current) g.current.scale.setScalar(THREE.MathUtils.lerp(g.current.scale.x, hover ? 1.06 : 1, dt * 10)); });
  const def = BUILDINGS[id];
  return (
    <group position={POS[id]} rotation={[0, ROT[id], 0]}>
      <group ref={g} onClick={(e) => { e.stopPropagation(); onSelect(id); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <Model id={id} L={level} />
        <mesh position={[0, 1.8, 0]} visible={false}><boxGeometry args={[5, 4, 5]} /></mesh>
      </group>
      <Html position={[0, 5.6 + (id === "hq" ? level * 0.8 : 0), 0]} center distanceFactor={16} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-lg ${level === 0 ? "border-dashed border-amber-300/70 bg-black/60 text-amber-200" : "border-amber-500/50 bg-black/70 text-amber-100"}`}>
          {def.name[lang]} · {level === 0 ? (lang === "tr" ? "İnşa Et" : "Build") : `${lang === "tr" ? "Sv." : "Lv."}${level}`}
        </div>
      </Html>
    </group>
  );
}

function Fire() {
  const l = useRef<THREE.PointLight>(null);
  const f = useRef<THREE.Group>(null);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (l.current) l.current.intensity = 55 + Math.sin(t * 13) * 10 + Math.sin(t * 7.3) * 8;
    if (f.current) f.current.children.forEach((c, i) => { c.scale.y = 0.8 + Math.sin(t * 9 + i * 2) * 0.25; });
  });
  return (
    <group position={[2.6, 0, 1.6]}>
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[Math.cos(i * 1.256) * 0.5, 0.12, Math.sin(i * 1.256) * 0.5]} rotation={[0, i, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.08, 0.7, 6]} /><Mat c={WOOD} /></mesh>)}
      <group ref={f}>
        {[[0, 0.5, 0.45, "#ff7a1e"], [0.1, 0.45, 0.32, "#ffb43a"], [-0.1, 0.4, 0.25, "#ffe08a"]].map(([x, y, s, c], i) => <mesh key={i} position={[x as number, y as number, 0]}><coneGeometry args={[s as number, 1, 7]} /><meshBasicMaterial color={c as string} /></mesh>)}
      </group>
      <pointLight ref={l} position={[0, 1.2, 0]} color="#ff9a4a" intensity={55} distance={26} decay={1.7} castShadow={false} />
      <Sparkles count={14} scale={[1, 3, 1]} position={[0, 1.5, 0]} size={3} speed={0.8} color="#ffb04a" />
    </group>
  );
}

function Lamps({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: Math.min(14, n) }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.2, r = 15.5;
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <Box p={[0, 1.4, 0]} s={[0.12, 2.8, 0.12]} c={METAL} m={0.8} />
            <mesh position={[0, 2.9, 0]}><sphereGeometry args={[0.22, 8, 8]} /><Mat c="#ffe9b8" e="#ffd27a" ei={3} /></mesh>
          </group>
        );
      })}
    </>
  );
}

function Ground() {
  const rocks = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ a: (i / 34) * Math.PI * 2, r: 19 + (i * 7 % 5) * 0.7, s: 1.2 + ((i * 13) % 7) * 0.35 })), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[20, 40]} /><meshStandardMaterial color="#4a3d30" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><ringGeometry args={[5.5, 5.9, 40]} /><meshStandardMaterial color="#8a7a60" roughness={1} /></mesh>
      <mesh position={[0, 6, 0]}><cylinderGeometry args={[27, 27, 14, 28, 1, true]} /><meshStandardMaterial color="#2a2420" side={THREE.BackSide} roughness={1} flatShading /></mesh>
      {rocks.map((r, i) => <mesh key={i} position={[Math.cos(r.a) * r.r, r.s * 0.4, Math.sin(r.a) * r.r]} scale={[r.s, r.s * 1.3, r.s]} castShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 2 ? "#3a322b" : "#463c33"} roughness={1} flatShading /></mesh>)}
    </group>
  );
}

export function CampView({ save, lang, quality, onSelect }: { save: Save; lang: Lang; quality: Quality; onSelect: (id: BuildingId) => void }) {
  const total = BUILDING_IDS.reduce((a, id) => a + save.buildings[id], 0);
  const anim = useRef(newAnim());
  return (
    <Canvas shadows={quality !== "low"} dpr={quality === "low" ? 1 : [1, 1.75]} camera={{ position: [0, 17, 27], fov: 48 }} style={{ touchAction: "none" }}>
      <color attach="background" args={["#0a0c18"]} />
      <fog attach="fog" args={["#0a0c18", 30, 80]} />
      <ambientLight intensity={0.9} color="#8aa0d8" />
      <directionalLight position={[-12, 22, 8]} intensity={1.1} color="#aab8ff" castShadow={quality !== "low"} shadow-mapSize={[1024, 1024]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} />
      <Suspense fallback={null}>
        <Stars radius={90} depth={40} count={quality === "low" ? 600 : 2200} factor={4} fade speed={0.6} />
        <Ground />
        {BUILDING_IDS.map((id) => <Building key={id} id={id} level={save.buildings[id]} lang={lang} onSelect={onSelect} />)}
        <Fire />
        <Lamps n={Math.floor(total / 1.5)} />
        <group position={[0, 0, 0.5]} rotation={[0, 0.6, 0]}><Explorer equipped={save.equipped} suit={save.suit} toolId={save.toolEquipped} anim={anim} scale={1.1} /></group>
        <Sparkles count={quality === "low" ? 0 : 50} scale={[34, 8, 34]} size={2} speed={0.2} color="#aac8ff" opacity={0.5} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={13} maxDistance={36} minPolarAngle={0.5} maxPolarAngle={1.35} target={[0, 1.5, -1.5]} autoRotate autoRotateSpeed={0.35} makeDefault />
    </Canvas>
  );
}

export function CharacterPreview({ equipped, suit, toolId }: { equipped: Record<Slot, string>; suit: string; toolId: string }) {
  const anim = useRef(newAnim());
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.5, 4.2], fov: 38 }} style={{ touchAction: "none" }}>
      <ambientLight intensity={0.8} color="#b8c4ff" />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff0d8" />
      <pointLight position={[-3, 2, 2]} intensity={20} color="#ffa860" />
      <Suspense fallback={null}>
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.3, 32]} /><meshStandardMaterial color="#2a2f3e" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.3, 1.38, 40]} /><meshBasicMaterial color="#ffb45a" /></mesh>
        <group scale={1.25}><Explorer equipped={equipped} suit={suit} toolId={toolId} anim={anim} /></group>
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} target={[0, 1.2, 0]} autoRotate autoRotateSpeed={2} minPolarAngle={1.1} maxPolarAngle={1.7} />
    </Canvas>
  );
}
