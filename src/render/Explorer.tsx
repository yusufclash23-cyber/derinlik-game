"use client";
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GEAR_BY_ID, LANTERN_COLORS, SUIT_COLORS, TOOL_BY_ID, type Slot } from "../game/config";

export interface AnimState { moving: boolean; mining: boolean; atk: number; dodge: number; dead: boolean; hurt: number; mineSpeed: number; shield: boolean }
export const newAnim = (): AnimState => ({ moving: false, mining: false, atk: 0, dodge: 0, dead: false, hurt: 0, mineSpeed: 1.6, shield: false });

const tierOf = (eq: Record<Slot, string>, s: Slot) => GEAR_BY_ID[eq[s]]?.tier ?? 0;
const HELM = ["#d9a62b", "#8e98a6", "#3c8fc4", "#e9b94a"];
const ARMOR = ["", "#6b4a32", "#59636f", "#8a2f1c"];
const PACK = ["#5b4630", "#6a5236", "#355c7a", "#4a3a68"];
const GLOVE = ["#d8d2c4", "#7a5230", "#59636f", "#c9a24a"];
const BOOT = ["#4a3a2a", "#5e4630", "#3f4d5c", "#2e3b4a"];

interface Props {
  equipped: Record<Slot, string>; suit: string; toolId: string; anim?: MutableRefObject<AnimState>; scale?: number;
}

export function Explorer({ equipped, suit, toolId, anim, scale = 1 }: Props) {
  const suitCol = SUIT_COLORS.find((s) => s.id === suit)?.color ?? "#e8751a";
  const th = tierOf(equipped, "helmet"), ta = tierOf(equipped, "armor"), tb = tierOf(equipped, "backpack");
  const tg = tierOf(equipped, "gloves"), ts = tierOf(equipped, "boots"), tl = tierOf(equipped, "lantern");
  const tool = TOOL_BY_ID[toolId] ?? TOOL_BY_ID.pick_basic;
  const body = useRef<THREE.Group>(null), lLeg = useRef<THREE.Group>(null), rLeg = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null), rArm = useRef<THREE.Group>(null), root = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const local = useMemo(() => ({ t: 0 }), []);
  const torsoCol = ta === 0 ? suitCol : ARMOR[ta];
  const lanternCol = LANTERN_COLORS[tl];
  const packS = 1 + tb * 0.18;

  useFrame((_, dt) => {
    const a = anim?.current;
    local.t += dt;
    const t = local.t;
    const mv = a?.moving ? 1 : 0;
    const w = Math.sin(t * 11) * 0.8 * mv;
    if (lLeg.current && rLeg.current) { lLeg.current.rotation.x = w; rLeg.current.rotation.x = -w; }
    if (body.current) body.current.position.y = Math.abs(Math.sin(t * 11)) * 0.05 * mv + (mv ? 0 : Math.sin(t * 1.8) * 0.012);
    let rax = mv ? -w * 0.9 : Math.sin(t * 1.8) * 0.04, lax = mv ? w * 0.9 : 0;
    if (a?.mining) rax = -0.7 - Math.abs(Math.sin(t * a.mineSpeed * Math.PI)) * 1.9;
    if (a && a.atk > 0) rax = -2.5 + (1 - a.atk / 0.3) * 2.8;
    if (rArm.current) rArm.current.rotation.x = rax;
    if (lArm.current) lArm.current.rotation.x = a?.mining ? -0.6 : lax;
    if (root.current) {
      root.current.rotation.x = a?.dead ? -Math.PI / 2 : a && a.dodge > 0 ? 0.9 : 0;
      root.current.position.y = a?.dead ? 0.2 : 0;
      const hurt = a && a.hurt > 0 ? 1 + a.hurt * 0.25 : 1;
      root.current.scale.setScalar(scale * hurt);
    }
    if (shieldRef.current) {
      shieldRef.current.visible = !!a?.shield;
      shieldRef.current.rotation.y += dt * 1.5;
      (shieldRef.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 6) * 0.05;
    }
  });

  return (
    <group ref={root} scale={scale}>
      {/* legs */}
      {([-1, 1] as const).map((s) => (
        <group key={s} ref={s < 0 ? lLeg : rLeg} position={[s * 0.15, 0.82, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.1, 0.4, 4, 8]} /><meshStandardMaterial color={ta === 0 ? "#3b3f4a" : ARMOR[ta]} roughness={0.8} /></mesh>
          <mesh position={[0, -0.7, 0.04]} castShadow><boxGeometry args={[0.2, 0.16, 0.3]} /><meshStandardMaterial color={BOOT[ts]} roughness={0.7} metalness={ts >= 2 ? 0.5 : 0} /></mesh>
          {ts >= 2 && <mesh position={[0, -0.64, 0.18]}><boxGeometry args={[0.14, 0.03, 0.04]} /><meshStandardMaterial color="#6fe3ff" emissive="#6fe3ff" emissiveIntensity={1.2} /></mesh>}
        </group>
      ))}
      <group ref={body}>
        {/* torso */}
        <mesh position={[0, 1.18, 0]} castShadow><boxGeometry args={[0.56, 0.66, 0.34]} /><meshStandardMaterial color={torsoCol} roughness={0.75} metalness={ta >= 2 ? 0.45 : 0.05} /></mesh>
        <mesh position={[0, 1.18, 0.175]}><boxGeometry args={[0.2, 0.62, 0.02]} /><meshStandardMaterial color={ta === 0 ? "#d8d2c4" : suitCol} emissive={ta === 3 ? "#ff5a1e" : "#000000"} emissiveIntensity={ta === 3 ? 1.2 : 0} /></mesh>
        <mesh position={[0, 0.86, 0]}><boxGeometry args={[0.58, 0.09, 0.36]} /><meshStandardMaterial color="#2b2118" roughness={0.9} /></mesh>
        {ta >= 1 && ([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.34, 1.46, 0]} castShadow><sphereGeometry args={[0.15 + ta * 0.015, 10, 8]} /><meshStandardMaterial color={ARMOR[ta]} metalness={0.5} roughness={0.5} /></mesh>
        ))}
        {/* head + helmet */}
        <group position={[0, 1.7, 0]}>
          <mesh castShadow><sphereGeometry args={[0.18, 14, 12]} /><meshStandardMaterial color="#e3b48d" roughness={0.8} /></mesh>
          <mesh position={[0, 0.06, 0.02]} castShadow>
            <sphereGeometry args={[th === 3 ? 0.27 : 0.215, 16, 12, 0, Math.PI * 2, 0, th === 3 ? Math.PI : Math.PI * 0.58]} />
            {th === 3 ? <meshPhysicalMaterial color="#9fe9ff" transparent opacity={0.4} roughness={0.05} metalness={0.2} /> : <meshStandardMaterial color={HELM[th]} metalness={th ? 0.6 : 0.1} roughness={0.45} />}
          </mesh>
          {th === 3 && <mesh position={[0, -0.17, 0]}><torusGeometry args={[0.2, 0.04, 8, 16]} /><meshStandardMaterial color={HELM[3]} metalness={0.8} roughness={0.3} /></mesh>}
          {th === 2 && <mesh position={[0, 0.02, 0.17]}><boxGeometry args={[0.3, 0.1, 0.05]} /><meshStandardMaterial color="#5fe0ff" emissive="#5fe0ff" emissiveIntensity={1.4} transparent opacity={0.85} /></mesh>}
          <mesh position={[0, 0.16, 0.2]}><cylinderGeometry args={[0.06, 0.08, 0.1, 10]} /><meshStandardMaterial color="#222" metalness={0.7} /></mesh>
          <mesh position={[0, 0.16, 0.26]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#fff6d6" emissive="#fff0b8" emissiveIntensity={3} /></mesh>
        </group>
        {/* backpack */}
        <group position={[0, 1.2, -0.27]} scale={packS}>
          <mesh castShadow><boxGeometry args={[0.44, 0.52, 0.22]} /><meshStandardMaterial color={PACK[tb]} roughness={0.9} /></mesh>
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.46, 0.08, 0.24]} /><meshStandardMaterial color="#2b2118" /></mesh>
          {tb >= 1 && ([-1, 1] as const).map((s) => (
            <mesh key={s} position={[s * 0.27, -0.02, 0]}><capsuleGeometry args={[0.07, 0.3, 4, 8]} /><meshStandardMaterial color={tb >= 2 ? "#c9d2da" : "#8b6b45"} metalness={0.6} roughness={0.4} /></mesh>
          ))}
          {tb >= 3 && <mesh position={[0, 0, -0.13]}><torusGeometry args={[0.14, 0.025, 6, 16]} /><meshStandardMaterial color="#b794ff" emissive="#b794ff" emissiveIntensity={2} /></mesh>}
        </group>
        {/* arms */}
        <group ref={lArm} position={[-0.37, 1.44, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow><capsuleGeometry args={[0.075, 0.34, 4, 8]} /><meshStandardMaterial color={torsoCol} roughness={0.8} /></mesh>
          <mesh position={[0, -0.55, 0]}><sphereGeometry args={[0.095, 8, 8]} /><meshStandardMaterial color={GLOVE[tg]} roughness={0.7} metalness={tg >= 2 ? 0.5 : 0} /></mesh>
        </group>
        <group ref={rArm} position={[0.37, 1.44, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow><capsuleGeometry args={[0.075, 0.34, 4, 8]} /><meshStandardMaterial color={torsoCol} roughness={0.8} /></mesh>
          <mesh position={[0, -0.55, 0]}><sphereGeometry args={[0.095, 8, 8]} /><meshStandardMaterial color={GLOVE[tg]} roughness={0.7} metalness={tg >= 2 ? 0.5 : 0} /></mesh>
          <group position={[0, -0.55, 0.05]} rotation={[Math.PI / 2, 0, 0]}><ToolModel color={tool.color} drill={tool.id.startsWith("drill")} crystal={tool.id === "pick_crystal"} /></group>
        </group>
        {/* hip lantern */}
        <group position={[-0.3, 0.8, 0.05]}>
          <mesh><sphereGeometry args={[0.07 + tl * 0.01, 8, 8]} /><meshStandardMaterial color={lanternCol} emissive={lanternCol} emissiveIntensity={2.2} /></mesh>
          <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[0.02, 0.02, 0.06, 6]} /><meshStandardMaterial color="#222" /></mesh>
        </group>
      </group>
      <mesh ref={shieldRef} position={[0, 1.0, 0]} visible={false}>
        <icosahedronGeometry args={[1.15, 1]} /><meshBasicMaterial color="#6fd0ff" transparent opacity={0.2} wireframe />
      </mesh>
    </group>
  );
}

function ToolModel({ color, drill, crystal }: { color: string; drill: boolean; crystal: boolean }) {
  if (drill) {
    return (
      <group>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.05, 0.05, 0.5, 8]} /><meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 0.58, 0]}><coneGeometry args={[0.11, 0.38, 8]} /><meshStandardMaterial color={color} metalness={0.9} roughness={0.2} emissive={color} emissiveIntensity={0.4} /></mesh>
        <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.025, 6, 12]} /><meshStandardMaterial color="#ffb04a" emissive="#ffb04a" emissiveIntensity={1.5} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.025, 0.03, 0.75, 6]} /><meshStandardMaterial color="#6b4a2a" roughness={0.9} /></mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.07, 0.5, 0.07]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.35} emissive={crystal ? color : "#000"} emissiveIntensity={crystal ? 0.8 : 0} /></mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.27, 0.5, 0]} rotation={[0, 0, (-s * Math.PI) / 2]}><coneGeometry args={[0.04, 0.14, 5]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.3} emissive={crystal ? color : "#000"} emissiveIntensity={crystal ? 1 : 0} /></mesh>
      ))}
    </group>
  );
}
