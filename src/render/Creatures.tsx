"use client";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Enemy } from "../game/engine";

type Ref<T> = React.RefObject<T | null>;
interface MP { e: Enemy; mat: Ref<THREE.MeshStandardMaterial>; t: Ref<{ t: number }> }

/** Shared per-enemy animation signals */
function sig(e: Enemy, t: number) {
  const walk = e.moving && e.state !== "dead" ? 1 : 0;
  const atk = e.state === "windup" ? -1 : e.state === "attack" ? Math.max(0, e.lunge / 0.3) : 0;
  return { walk, atk, w: Math.sin(t * (e.def.speed * 2.4)) * walk, idle: Math.sin(t * 2 + e.id) };
}

function Crawler({ e, mat }: MP) {
  const legs = useRef<(THREE.Group | null)[]>([]);
  const body = useRef<THREE.Group>(null);
  const tm = useRef(0);
  useFrame((_, dt) => {
    tm.current += dt;
    const s = sig(e, tm.current);
    legs.current.forEach((l, i) => { if (l) l.rotation.z = (i % 2 ? 1 : -1) * (0.5 + s.w * 0.5 * (i % 4 < 2 ? 1 : -1)); });
    if (body.current) { body.current.position.z = s.atk > 0 ? s.atk * 0.5 : 0; body.current.position.y = 0.35 + Math.abs(s.w) * 0.05 + s.idle * 0.01; body.current.rotation.x = s.atk < 0 ? -0.35 : 0; }
  });
  return (
    <group ref={body}>
      <mesh scale={[0.75, 0.42, 1.05]} castShadow><sphereGeometry args={[0.6, 12, 10]} /><meshStandardMaterial ref={mat} color={e.def.tint} roughness={0.7} /></mesh>
      <mesh position={[0, 0.05, 0.6]} castShadow><sphereGeometry args={[0.28, 10, 8]} /><meshStandardMaterial color={e.def.tint} roughness={0.6} /></mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.13, 0.12, 0.82]}><sphereGeometry args={[0.055, 6, 6]} /><meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={3} /></mesh>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const side = i % 2 ? 1 : -1, zz = 0.35 - Math.floor(i / 2) * 0.4;
        return (
          <group key={i} ref={(g) => { legs.current[i] = g; }} position={[side * 0.4, 0, zz]}>
            <mesh position={[side * 0.28, -0.12, 0]} rotation={[0, 0, side * 0.9]}><cylinderGeometry args={[0.03, 0.045, 0.6, 5]} /><meshStandardMaterial color="#2a2018" /></mesh>
          </group>
        );
      })}
      {[-0.25, 0, 0.25].map((z, i) => <mesh key={i} position={[0, 0.27, z - 0.1]}><coneGeometry args={[0.07, 0.2, 5]} /><meshStandardMaterial color="#a89070" /></mesh>)}
    </group>
  );
}

function Guardian({ e, mat }: MP) {
  const arms = useRef<(THREE.Group | null)[]>([]);
  const body = useRef<THREE.Group>(null);
  const tm = useRef(0);
  useFrame((_, dt) => {
    tm.current += dt;
    const s = sig(e, tm.current);
    arms.current.forEach((a, i) => { if (a) a.rotation.x = s.atk < 0 ? -2.4 : s.atk > 0 ? 0.2 - s.atk * 1.2 : (i ? 1 : -1) * s.w * 0.6 + s.idle * 0.05; });
    if (body.current) body.current.position.y = 1.05 + Math.abs(s.w) * 0.06 + s.idle * 0.02;
  });
  return (
    <group ref={body}>
      <mesh castShadow><boxGeometry args={[0.95, 1.1, 0.6]} /><meshStandardMaterial ref={mat} color="#3a4258" roughness={0.9} metalness={0.2} /></mesh>
      <mesh position={[0, 0.78, 0.05]} castShadow><octahedronGeometry args={[0.32, 0]} /><meshStandardMaterial color="#4a5470" roughness={0.8} /></mesh>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.1, 0.8, 0.28]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color={e.def.tint} emissive={e.def.tint} emissiveIntensity={3} /></mesh>)}
      {[[-0.4, 0.7, -0.3, 0.3], [0.35, 0.8, -0.25, 0.4], [0, 0.5, -0.4, 0.5], [0.15, 0.9, 0.1, 0.25]].map(([x, y, z, h], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[-0.4, 0, (i - 1.5) * 0.3]}><coneGeometry args={[0.1, h * 2, 6]} /><meshStandardMaterial color={e.def.tint} emissive={e.def.tint} emissiveIntensity={1.6} transparent opacity={0.9} /></mesh>
      ))}
      {([-1, 1] as const).map((s, i) => (
        <group key={s} ref={(g) => { arms.current[i] = g; }} position={[s * 0.62, 0.45, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow><boxGeometry args={[0.3, 0.9, 0.3]} /><meshStandardMaterial color="#3a4258" roughness={0.9} /></mesh>
          <mesh position={[0, -0.95, 0]}><dodecahedronGeometry args={[0.24, 0]} /><meshStandardMaterial color={e.def.tint} emissive={e.def.tint} emissiveIntensity={0.8} /></mesh>
        </group>
      ))}
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.25, -0.85, 0]} castShadow><boxGeometry args={[0.3, 0.6, 0.35]} /><meshStandardMaterial color="#2f3548" roughness={0.9} /></mesh>)}
    </group>
  );
}

function Stalker({ e, mat }: MP) {
  const arms = useRef<(THREE.Group | null)[]>([]);
  const body = useRef<THREE.Group>(null);
  const tm = useRef(0);
  useFrame((_, dt) => {
    tm.current += dt;
    const s = sig(e, tm.current);
    arms.current.forEach((a, i) => { if (a) a.rotation.x = s.atk < 0 ? -2.2 : s.atk > 0 ? 0.3 : 0.25 + (i ? 1 : -1) * s.w * 0.6 + s.idle * 0.06; });
    if (body.current) { body.current.position.y = 1.15 + s.idle * 0.06; body.current.rotation.x = s.walk * 0.25 + (s.atk > 0 ? 0.4 : 0); body.current.position.z = s.atk > 0 ? s.atk * 0.6 : 0; }
  });
  return (
    <group ref={body}>
      <mesh castShadow><capsuleGeometry args={[0.22, 1.0, 4, 10]} /><meshStandardMaterial ref={mat} color="#150f1f" roughness={0.4} transparent opacity={0.92} /></mesh>
      <mesh position={[0, 0.85, 0.08]} scale={[0.8, 1.2, 0.9]}><sphereGeometry args={[0.24, 10, 8]} /><meshStandardMaterial color="#0f0a18" roughness={0.4} /></mesh>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.09, 0.9, 0.27]}><sphereGeometry args={[0.045, 6, 6]} /><meshStandardMaterial color="#ffffff" emissive="#d8d0ff" emissiveIntensity={4} /></mesh>)}
      {([-1, 1] as const).map((s, i) => (
        <group key={s} ref={(g) => { arms.current[i] = g; }} position={[s * 0.3, 0.45, 0]}>
          <mesh position={[0, -0.5, 0]}><capsuleGeometry args={[0.05, 1.0, 3, 6]} /><meshStandardMaterial color="#150f1f" /></mesh>
          {[-1, 0, 1].map((k) => <mesh key={k} position={[k * 0.04, -1.15, 0.05]} rotation={[0.3, 0, k * 0.2]}><coneGeometry args={[0.025, 0.25, 4]} /><meshStandardMaterial color={e.def.tint} emissive={e.def.tint} emissiveIntensity={1.5} /></mesh>)}
        </group>
      ))}
      <mesh position={[0, -0.9, 0]}><coneGeometry args={[0.25, 0.8, 8]} /><meshStandardMaterial color="#150f1f" transparent opacity={0.6} /></mesh>
    </group>
  );
}

function LavaBeast({ e, mat }: MP) {
  const legs = useRef<(THREE.Group | null)[]>([]);
  const body = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const tm = useRef(0);
  useFrame((_, dt) => {
    tm.current += dt;
    const s = sig(e, tm.current);
    legs.current.forEach((l, i) => { if (l) l.rotation.x = Math.sin(tm.current * 6 + (i % 2 ? Math.PI : 0)) * 0.5 * s.walk; });
    if (body.current) { body.current.position.y = 0.9 + Math.abs(s.w) * 0.06; body.current.rotation.x = s.atk < 0 ? -0.3 : 0; body.current.position.z = s.atk > 0 ? s.atk * 0.7 : 0; }
    if (glow.current) glow.current.emissiveIntensity = 1.5 + Math.sin(tm.current * 3) * 0.6 + (e.state === "windup" ? 2 : 0);
  });
  return (
    <group ref={body}>
      <mesh scale={[1, 0.75, 1.35]} castShadow><sphereGeometry args={[0.8, 12, 10]} /><meshStandardMaterial ref={mat} color="#2a1410" roughness={0.95} /></mesh>
      {[[-0.4, 0.5, 0.2], [0.35, 0.55, -0.3], [0, 0.6, 0.5], [0.5, 0.2, 0.6], [-0.5, 0.25, -0.5]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}><sphereGeometry args={[0.13, 6, 6]} /><meshStandardMaterial ref={i === 0 ? glow : undefined} color="#ff7a1e" emissive="#ff5a1e" emissiveIntensity={2} /></mesh>
      ))}
      <group position={[0, 0.15, 1.1]}>
        <mesh castShadow><boxGeometry args={[0.7, 0.55, 0.65]} /><meshStandardMaterial color="#2a1410" roughness={0.9} /></mesh>
        <mesh position={[0, -0.12, 0.3]}><boxGeometry args={[0.5, 0.12, 0.1]} /><meshStandardMaterial color="#ffb02a" emissive="#ff7a1e" emissiveIntensity={3} /></mesh>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.32, 0.4, 0]} rotation={[0, 0, -s * 0.5]}><coneGeometry args={[0.1, 0.5, 6]} /><meshStandardMaterial color="#1a0d0a" /></mesh>)}
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.2, 0.08, 0.33]}><sphereGeometry args={[0.06, 6, 6]} /><meshStandardMaterial color="#ffee66" emissive="#ffdd44" emissiveIntensity={4} /></mesh>)}
      </group>
      {[[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.6], [0.5, -0.6]].map(([x, z], i) => (
        <group key={i} ref={(g) => { legs.current[i] = g; }} position={[x, -0.2, z]}>
          <mesh position={[0, -0.35, 0]} castShadow><cylinderGeometry args={[0.17, 0.22, 0.8, 7]} /><meshStandardMaterial color="#2a1410" roughness={0.95} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Sentinel({ e, mat }: MP) {
  const ring = useRef<THREE.Mesh>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const body = useRef<THREE.Group>(null);
  const eye = useRef<THREE.MeshStandardMaterial>(null);
  const tm = useRef(0);
  useFrame((_, dt) => {
    tm.current += dt;
    const s = sig(e, tm.current);
    if (ring.current) ring.current.rotation.z += dt * (e.state === "windup" ? 8 : 1.5);
    arms.current.forEach((a, i) => { if (a) a.rotation.x = s.atk < 0 ? -2.6 : s.atk > 0 ? 0.3 - s.atk * 1.4 : (i ? 1 : -1) * s.w * 0.4; });
    if (body.current) { body.current.position.y = 1.25 + Math.abs(s.w) * 0.05 + s.idle * 0.02; }
    if (eye.current) eye.current.emissiveIntensity = 2.5 + (e.state === "windup" ? 3 : 0) + Math.sin(tm.current * 4);
  });
  return (
    <group ref={body}>
      <mesh castShadow><boxGeometry args={[0.9, 1.0, 0.6]} /><meshStandardMaterial ref={mat} color={e.def.tint} metalness={0.8} roughness={0.35} /></mesh>
      <mesh position={[0, 0.2, 0.31]}><boxGeometry args={[0.5, 0.35, 0.03]} /><meshStandardMaterial color="#2a2a30" metalness={0.9} roughness={0.3} /></mesh>
      <mesh position={[0, 0.85, 0]} castShadow><cylinderGeometry args={[0.3, 0.38, 0.4, 8]} /><meshStandardMaterial color="#6a5a40" metalness={0.8} roughness={0.4} /></mesh>
      <mesh position={[0, 0.88, 0.3]}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial ref={eye} color="#7fffe0" emissive="#3fffd8" emissiveIntensity={3} /></mesh>
      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.85, 0.05, 6, 24]} /><meshStandardMaterial color="#3fffd8" emissive="#3fffd8" emissiveIntensity={1.8} /></mesh>
      {([-1, 1] as const).map((s, i) => (
        <group key={s} ref={(g) => { arms.current[i] = g; }} position={[s * 0.62, 0.35, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow><boxGeometry args={[0.24, 0.8, 0.24]} /><meshStandardMaterial color="#6a5a40" metalness={0.8} roughness={0.4} /></mesh>
          <mesh position={[0, -1.0, 0.1]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.1, 0.7, 0.35]} /><meshStandardMaterial color="#c9d2da" metalness={1} roughness={0.2} /></mesh>
        </group>
      ))}
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.28, -0.85, 0]} castShadow><boxGeometry args={[0.3, 0.8, 0.35]} /><meshStandardMaterial color="#4a4030" metalness={0.8} roughness={0.5} /></mesh>)}
    </group>
  );
}

export function Creature({ e }: { e: Enemy }) {
  const root = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const tref = useRef({ t: 0 });
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    const g = root.current; if (!g) return;
    const dead = e.state === "dead";
    g.position.set(e.x, dead ? -Math.min(1.2, e.deadT * 0.6) : 0, e.z);
    g.rotation.y = e.facing;
    const sc = e.def.scale * (dead ? Math.max(0.01, 1 - Math.max(0, e.deadT - 0.8) * 0.8) : 1);
    g.scale.setScalar(sc);
    g.rotation.z = dead ? Math.min(1.4, e.deadT * 4) : e.state === "stunned" ? Math.sin(performance.now() / 60) * 0.1 : 0;
    g.visible = !(dead && e.deadT > 2.2);
    if (mat.current) {
      mat.current.emissive.set(e.hit > 0 ? "#ffffff" : e.state === "windup" ? "#aa1111" : "#000000");
      mat.current.emissiveIntensity = e.hit > 0 ? 0.9 : e.state === "windup" ? 0.8 : 0;
    }
    if (bar.current && fill.current) {
      bar.current.visible = !dead && (e.aggro || e.hp < e.maxHp);
      bar.current.quaternion.copy(camera.quaternion);
      fill.current.scale.x = Math.max(0.001, e.hp / e.maxHp);
      fill.current.position.x = -(1 - fill.current.scale.x) * 0.5;
    }
    tref.current.t += dt;
  });
  const P = { e, mat, t: tref };
  const h = 2.2 * (e.def.scale > 1.5 ? 1.2 : 1);
  return (
    <group ref={root}>
      {e.def.model === "crawler" && <Crawler {...P} />}
      {e.def.model === "guardian" && <Guardian {...P} />}
      {e.def.model === "stalker" && <Stalker {...P} />}
      {e.def.model === "lavaBeast" && <LavaBeast {...P} />}
      {e.def.model === "sentinel" && <Sentinel {...P} />}
      {e.boss && <pointLight color={e.def.tint} intensity={6} distance={9} position={[0, 1.5, 0]} />}
      <group ref={bar} position={[0, h, 0]} scale={e.boss ? 1.6 : 1}>
        <mesh><planeGeometry args={[1.1, 0.12]} /><meshBasicMaterial color="#000" transparent opacity={0.6} depthTest={false} /></mesh>
        <mesh ref={fill} position={[0, 0, 0.001]} scale={[1, 1, 1]}><planeGeometry args={[1.04, 0.08]} /><meshBasicMaterial color={e.boss ? "#ff4fd8" : "#ff4a3a"} depthTest={false} /></mesh>
      </group>
    </group>
  );
}
