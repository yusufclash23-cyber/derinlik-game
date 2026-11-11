"use client";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, PerformanceMonitor, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { BIOMES, GEAR_BY_ID, RARITY_COLOR, RESOURCES, rarityIdx, type Slot } from "../game/config";
import type { Ev, Expedition } from "../game/engine";
import { audio } from "../game/audio";
import { pick, type Lang } from "../game/i18n";
import type { RemotePlayer } from "../game/net";
import { Explorer, newAnim, type AnimState } from "./Explorer";
import { Creature } from "./Creatures";
import { DepositMesh, ExitMesh, HazardMesh, LostPackMesh, PropMesh } from "./World";
import { Terrain } from "./Terrain";

export type Quality = "low" | "medium" | "high";
export interface InputRef { mx: number; mz: number; mining: boolean; extracting: boolean }

export function resolveQuality(s: "auto" | Quality): Quality {
  if (s !== "auto") return s;
  if (typeof navigator === "undefined") return "medium";
  const n = navigator as Navigator & { deviceMemory?: number };
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = n.hardwareConcurrency ?? 4, mem = n.deviceMemory ?? 4;
  if (mobile && (cores <= 4 || mem <= 3)) return "low";
  if (mobile) return "medium";
  return cores >= 8 && mem >= 8 ? "high" : "medium";
}
const QCFG = {
  low: { dpr: [0.7, 1] as [number, number], particles: 60, lights: 0, shadows: false, sparkles: 0 },
  medium: { dpr: [1, 1.5] as [number, number], particles: 140, lights: 2, shadows: false, sparkles: 30 },
  high: { dpr: [1, 2] as [number, number], particles: 300, lights: 3, shadows: true, sparkles: 60 },
};

interface FxApi { burst: (x: number, y: number, z: number, color: string, n: number, speed?: number) => void }
function Particles({ max, api }: { max: number; api: MutableRefObject<FxApi | null> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => ({ pos: new Float32Array(max * 3), vel: new Float32Array(max * 3), life: new Float32Array(max), size: new Float32Array(max), head: 0 }), [max]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = mesh.current; if (!m) return;
    m.setColorAt(0, new THREE.Color("#fff"));
    for (let i = 0; i < max; i++) { o.scale.setScalar(0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
    const c = new THREE.Color();
    api.current = {
      burst: (x, y, z, color, n, speed = 4) => {
        c.set(color);
        for (let k = 0; k < n; k++) {
          const i = d.head++ % max;
          d.pos[i * 3] = x; d.pos[i * 3 + 1] = y; d.pos[i * 3 + 2] = z;
          const a = Math.random() * 6.283, s = (0.3 + Math.random()) * speed;
          d.vel[i * 3] = Math.cos(a) * s; d.vel[i * 3 + 1] = 2 + Math.random() * speed; d.vel[i * 3 + 2] = Math.sin(a) * s;
          d.life[i] = 0.5 + Math.random() * 0.6; d.size[i] = 0.06 + Math.random() * 0.1;
          m.setColorAt(i, c);
        }
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      },
    };
    return () => { api.current = null; };
  }, [api, d, max, o]);
  useFrame((_, dt) => {
    const m = mesh.current; if (!m) return;
    for (let i = 0; i < max; i++) {
      if (d.life[i] <= 0) continue;
      d.life[i] -= dt;
      d.vel[i * 3 + 1] -= 11 * dt;
      d.pos[i * 3] += d.vel[i * 3] * dt; d.pos[i * 3 + 1] += d.vel[i * 3 + 1] * dt; d.pos[i * 3 + 2] += d.vel[i * 3 + 2] * dt;
      if (d.pos[i * 3 + 1] < 0.05) { d.pos[i * 3 + 1] = 0.05; d.vel[i * 3 + 1] *= -0.3; d.vel[i * 3] *= 0.6; d.vel[i * 3 + 2] *= 0.6; }
      o.position.set(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]);
      o.scale.setScalar(d.life[i] > 0 ? d.size[i] * Math.min(1, d.life[i] * 2.5) : 0);
      o.rotation.set(d.life[i] * 6, d.life[i] * 4, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, max]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Loop({ eng, input, onEvents, zoom }: { eng: Expedition; input: MutableRefObject<InputRef>; onEvents: (e: Ev[]) => void; zoom: MutableRefObject<number> }) {
  const { camera } = useThree();
  const step = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const i = input.current;
    eng.tick(dt, { mx: i.mx, mz: i.mz, mining: i.mining, extracting: i.extracting });
    const evs = eng.drainEvents();
    if (evs.length) onEvents(evs);
    if (eng.p.moving) { step.current += dt; if (step.current > 0.36) { step.current = 0; audio.play("step"); } }
    // smooth, collision-safe follow camera: always far above the 3.4 m walls, steep enough to never be occluded
    const z = zoom.current;
    const shake = eng.p.hurtT > 0 ? (Math.random() - 0.5) * 0.35 : 0;
    target.set(eng.p.x + shake, Math.max(9, 15 * z), eng.p.z + 8.5 * z + shake);
    camera.position.lerp(target, 1 - Math.exp(-7 * dt));
    camera.lookAt(eng.p.x, 0.6, eng.p.z - 0.4);
  });
  return null;
}

function Player({ eng, input, equipped, suit }: { eng: Expedition; input: MutableRefObject<InputRef>; equipped: Record<Slot, string>; suit: string }) {
  const g = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const sparkle = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>(newAnim());
  const lanternTier = GEAR_BY_ID[equipped.lantern]?.tier ?? 0;
  const lcol = ["#ffc982", "#ffd9a0", "#a8e4ff", "#fff0c4"][lanternTier];
  useFrame(() => {
    const p = eng.p, a = anim.current;
    if (g.current) { g.current.position.set(p.x, 0, p.z); g.current.rotation.y = p.facing; }
    a.moving = p.moving; a.mining = input.current.mining && eng.nearDep !== null && !p.moving; a.atk = p.atkT; a.dodge = p.dodgeAnim;
    a.dead = eng.status === "dead"; a.hurt = p.hurtT; a.shield = p.shield > 0; a.mineSpeed = eng.stats.tool.speed * eng.stats.speedMult;
    if (light.current) { light.current.distance = (eng.stats.light + (p.flareT > 0 ? 14 : 0)) * 2.4; light.current.intensity = 55 + (p.flareT > 0 ? 160 : 0); }
    if (sparkle.current) sparkle.current.position.set(p.x, 2, p.z);
  });
  return (
    <>
      <group ref={g}>
        <Explorer equipped={equipped} suit={suit} toolId={eng.stats.tool.id} anim={anim} />
        <pointLight ref={light} position={[0, 2.8, 0.6]} color={lcol} intensity={70} distance={22} decay={1.6} castShadow={false} />
      </group>
      <group ref={sparkle} />
    </>
  );
}

function PooledLights({ eng, n }: { eng: Expedition; n: number }) {
  const refs = useRef<(THREE.PointLight | null)[]>([]);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const src: { x: number; z: number; c: string; d: number }[] = [];
    for (const ds of eng.deposits) {
      if (!ds.alive || !ds.d.res) continue;
      const def = RESOURCES[ds.d.res];
      if (def.glow < 1) continue;
      const d = Math.hypot(ds.d.x - eng.p.x, ds.d.z - eng.p.z);
      if (d < 32) src.push({ x: ds.d.x, z: ds.d.z, c: def.color, d });
    }
    for (const h of eng.mine.hazards) if (h.type === "lava") { const d = Math.hypot(h.x - eng.p.x, h.z - eng.p.z); if (d < 32) src.push({ x: h.x, z: h.z, c: "#ff6a2a", d }); }
    src.sort((a, b) => a.d - b.d);
    for (let i = 0; i < n; i++) {
      const l = refs.current[i]; if (!l) continue;
      const s = src[i];
      if (s) { l.position.set(s.x, 1.6, s.z); l.color.set(s.c); l.intensity = 28; } else l.intensity = 0;
    }
  });
  return <>{Array.from({ length: n }, (_, i) => <pointLight key={i} ref={(l) => { refs.current[i] = l; }} intensity={0} distance={11} decay={2} />)}</>;
}

function RemoteAvatars({ remote }: { remote: MutableRefObject<RemotePlayer[]> }) {
  const [ids, setIds] = useState<string[]>([]);
  useFrame(() => {
    const k = remote.current.map((r) => r.id);
    if (k.join() !== ids.join()) setIds(k);
  });
  const eq = useMemo(() => ({ helmet: "helmet1", armor: "armor1", backpack: "backpack1", gloves: "gloves1", boots: "boots1", lantern: "lantern1" }) as Record<Slot, string>, []);
  return <>{ids.map((id) => <Remote key={id} id={id} remote={remote} eq={eq} />)}</>;
}
function Remote({ id, remote, eq }: { id: string; remote: MutableRefObject<RemotePlayer[]>; eq: Record<Slot, string> }) {
  const g = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>(newAnim());
  const last = useRef({ x: 0, z: 0, init: false });
  const name = remote.current.find((r) => r.id === id)?.name ?? "";
  useFrame((_, dt) => {
    const r = remote.current.find((q) => q.id === id); if (!r || !g.current) return;
    const l = last.current;
    if (!l.init) { l.x = r.x; l.z = r.z; l.init = true; }
    const px = l.x, pz = l.z;
    l.x += (r.x - l.x) * Math.min(1, dt * 8); l.z += (r.z - l.z) * Math.min(1, dt * 8);
    anim.current.moving = Math.hypot(l.x - px, l.z - pz) / Math.max(dt, 0.001) > 0.8;
    anim.current.mining = r.a === "mine"; anim.current.atk = r.a === "attack" ? 0.15 : 0; anim.current.dead = r.a === "dead";
    g.current.position.set(l.x, 0, l.z); g.current.rotation.y = r.f;
  });
  return (
    <group ref={g}>
      <Explorer equipped={eq} suit="teal" toolId="pick_iron" anim={anim} />
      <Html position={[0, 2.5, 0]} center distanceFactor={14} zIndexRange={[5, 0]}><div className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-teal-200">{name}</div></Html>
    </group>
  );
}

interface Floater { id: number; x: number; z: number; text: string; color: string }

export interface MineViewProps {
  eng: Expedition; input: MutableRefObject<InputRef>; quality: Quality; lang: Lang; onEvent: (e: Ev) => void;
  remote: MutableRefObject<RemotePlayer[]>; equipped: Record<Slot, string>; suit: string; zoom: MutableRefObject<number>;
}

export function MineView({ eng, input, quality: q0, lang, onEvent, remote, equipped, suit, zoom }: MineViewProps) {
  const [q, setQ] = useState<Quality>(q0);
  const cfg = QCFG[q];
  const [factor, setFactor] = useState(1);
  const fx = useRef<FxApi | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const fid = useRef(0);
  const [version, setVersion] = useState(0);
  const biome = BIOMES[eng.biomeIdx];

  const floater = useCallback((x: number, z: number, text: string, color: string) => {
    const id = ++fid.current;
    setFloaters((f) => [...f.slice(-7), { id, x, z, text, color }]);
    setTimeout(() => setFloaters((f) => f.filter((q) => q.id !== id)), 950);
  }, []);

  const onEvents = useCallback((evs: Ev[]) => {
    for (const e of evs) {
      const x = e.x ?? 0, z = e.z ?? 0;
      switch (e.t) {
        case "mineHit": {
          const def = e.res ? RESOURCES[e.res] : null;
          fx.current?.burst(x, 1.1, z, def?.color ?? "#c9b99a", 6, 3);
          audio.play(def && (def.kind === "crystal" || def.kind === "gem") ? "crystal" : "mine", def ? rarityIdx(def.rarity) : 0);
          break;
        }
        case "break": fx.current?.burst(x, 1, z, e.res ? RESOURCES[e.res].color : "#c9b99a", 28, 5); audio.play("break"); break;
        case "secret": fx.current?.burst(x, 1.5, z, "#ffb45a", 50, 6); audio.play("secret"); setVersion((v) => v + 1); break;
        case "pickup": if (e.res) { floater(x, z, `+${e.n} ${pick(lang, RESOURCES[e.res].name)}`, RARITY_COLOR[RESOURCES[e.res].rarity]); audio.play("pickup"); } break;
        case "hit": fx.current?.burst(x, 1.2, z, e.big ? "#ffd84a" : "#ff6a4a", e.big ? 14 : 8, 4); floater(x, z, String(e.n), e.big ? "#ffd84a" : "#fff"); audio.play("hit"); break;
        case "hurt": floater(eng.p.x, eng.p.z, `-${e.n}`, "#ff4a4a"); audio.play("hurt"); break;
        case "enemyDie": fx.current?.burst(x, 1, z, "#aaa", 30, 5); audio.play("enemyDie"); break;
        case "enemyAtk": audio.play("enemyAtk"); break;
        case "swing": audio.play("swing"); break;
        case "dodge": audio.play("dodge"); break;
        case "strike": fx.current?.burst(x, 1, z, "#ffd84a", 20, 6); audio.play("strike"); break;
        case "shield": audio.play("shield"); break;
        case "flare": fx.current?.burst(x, 2, z, "#ffe6a0", 40, 8); audio.play("flare"); break;
        case "shieldHit": fx.current?.burst(x, 1.3, z, "#6fd0ff", 10, 4); break;
        case "hidden": audio.play("hidden"); break;
        case "discover": audio.play("discover"); break;
        case "extractStart": audio.play("extract"); break;
        case "extracted": audio.play("extracted"); break;
        case "dead": audio.play("dead"); audio.setBoss(false); break;
        case "bossStart": audio.play("boss"); audio.setBoss(true); break;
        case "bossDead": fx.current?.burst(x, 2, z, "#ffd84a", 80, 9); audio.play("bossDead"); audio.setBoss(false); break;
        case "lowO2": case "lowHp": audio.play("warn"); break;
        case "weak": case "noEnergy": audio.play("error"); break;
        case "full": audio.play("full"); break;
        case "heal": audio.play("heal"); break;
        case "exitFound": audio.play("ui"); break;
        case "lostPack": audio.play("pickup"); break;
      }
      onEvent(e);
    }
  }, [floater, lang, onEvent, eng]);

  useEffect(() => { audio.startAmbience(eng.biomeIdx); return () => audio.stopAmbience(); }, [eng.biomeIdx]);

  const dpr = Math.min(window.devicePixelRatio || 1, cfg.dpr[0] + (cfg.dpr[1] - cfg.dpr[0]) * factor);
  return (
    <Canvas shadows={cfg.shadows} dpr={dpr} gl={{ antialias: q !== "low", powerPreference: "high-performance" }} camera={{ position: [eng.p.x, 15, eng.p.z + 8.5], fov: 48, near: 0.5, far: 95 }}
      style={{ touchAction: "none" }}>
      <PerformanceMonitor flipflops={3} onChange={({ factor: f }) => setFactor(f)} onFallback={() => setQ((c) => (c === "high" ? "medium" : "low"))} />
      <color attach="background" args={[biome.fog]} />
      <fog attach="fog" args={[biome.fog, 11, 46]} />
      <ambientLight intensity={0.5} color={biome.ambient} />
      <hemisphereLight args={[biome.ambient, biome.floor, 0.22]} />
      <Suspense fallback={null}>
        <Loop eng={eng} input={input} onEvents={onEvents} zoom={zoom} />
        <Terrain eng={eng} biome={eng.biomeIdx} version={version} shadows={cfg.shadows} />
        {eng.deposits.map((ds) => <DepositMesh key={ds.d.id} ds={ds} eng={eng} biome={eng.biomeIdx} />)}
        {eng.mine.props.map((p, i) => <PropMesh key={i} p={p} eng={eng} biome={eng.biomeIdx} />)}
        {eng.mine.hazards.map((h) => <HazardMesh key={h.id} h={h} eng={eng} />)}
        {eng.mine.exits.map((x, i) => <ExitMesh key={i} x={0} exit={x} eng={eng} index={i} />)}
        {eng.enemies.map((e) => <Creature key={e.id} e={e} />)}
        <LostPackMesh eng={eng} />
        <Player eng={eng} input={input} equipped={equipped} suit={suit} />
        <RemoteAvatars remote={remote} />
        {cfg.lights > 0 && <PooledLights eng={eng} n={cfg.lights} />}
        <Particles max={cfg.particles} api={fx} />
        {cfg.sparkles > 0 && <FollowSparkles eng={eng} count={cfg.sparkles} color={biome.accent} />}
      </Suspense>
      {floaters.map((f) => (
        <Html key={f.id} position={[f.x, 2.2, f.z]} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
          <div className="float-up whitespace-nowrap text-sm font-extrabold" style={{ color: f.color, textShadow: "0 1px 3px #000" }}>{f.text}</div>
        </Html>
      ))}
    </Canvas>
  );
}

function FollowSparkles({ eng, count, color }: { eng: Expedition; count: number; color: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => g.current?.position.set(eng.p.x, 2, eng.p.z));
  return <group ref={g}><Sparkles count={count} scale={[16, 5, 16]} size={2.2} speed={0.25} color={color} opacity={0.6} /></group>;
}
