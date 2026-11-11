"use client";
import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as RPE, type ReactNode } from "react";
import { RESOURCES, TOOL_BY_ID } from "../game/config";
import { ABILITY_CD, ATTACK_CD, DODGE_CD, type Expedition } from "../game/engine";
import { TH, TW } from "../game/gen";
import type { InputRef } from "../render/MineScene";
import { audio } from "../game/audio";
import { useGame } from "../game/store";

type Snap = ReturnType<Expedition["snapshot"]>;

function Bar({ label, value, max, color, warn }: { label: string; value: number; max: number; color: string; warn?: boolean }) {
  const f = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-11 text-[9px] font-bold uppercase tracking-tight text-white/80 drop-shadow">{label}</span>
      <div className={`relative h-3 w-[84px] overflow-hidden rounded-full border border-white/20 bg-black/55 sm:w-40 ${warn ? "animate-pulse border-red-400" : ""}`}>
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${f * 100}%`, background: warn ? "#ff3b3b" : color }} />
        <span className="absolute inset-0 text-center text-[9px] font-bold leading-3 text-white drop-shadow">{Math.ceil(value)}/{Math.round(max)}</span>
      </div>
    </div>
  );
}

function ActionBtn({ size, label, sub, cd = 0, color, onDown, onUp, disabled, children }: {
  size: number; label: string; sub?: string; cd?: number; color: string; onDown?: () => void; onUp?: () => void; disabled?: boolean; children?: ReactNode;
}) {
  return (
    <button
      className="relative select-none rounded-full border-2 font-extrabold text-white shadow-lg active:scale-95"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${color}, #1a1410)`, borderColor: disabled ? "#555" : color, opacity: disabled ? 0.6 : 1, touchAction: "none" }}
      onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); audio.resume(); onDown?.(); }}
      onPointerUp={() => onUp?.()} onPointerCancel={() => onUp?.()} onContextMenu={(e) => e.preventDefault()}>
      {cd > 0 && <span className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(0,0,0,.72) ${cd * 360}deg, transparent 0)` }} />}
      <span className="relative flex flex-col items-center leading-none">
        <span style={{ fontSize: size > 70 ? 16 : 11 }}>{label}</span>
        {sub && <span className="mt-0.5 text-[9px] font-semibold text-white/80">{sub}</span>}
        {children}
      </span>
    </button>
  );
}

function Minimap({ eng }: { eng: Expedition }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const S = 104, W = 41, px = S / W;
    const id = setInterval(() => {
      ctx.fillStyle = "#07090f"; ctx.fillRect(0, 0, S, S);
      const ptx = Math.floor(eng.p.x / 2), ptz = Math.floor(eng.p.z / 2);
      for (let dz = -20; dz <= 20; dz++) for (let dx = -20; dx <= 20; dx++) {
        const x = ptx + dx, z = ptz + dz;
        if (x < 0 || z < 0 || x >= TW || z >= TH || !eng.explored[z * TW + x]) continue;
        const v = eng.tiles[z * TW + x];
        ctx.fillStyle = v === 1 ? "#4a4f63" : "#1b1e2b";
        ctx.fillRect((dx + 20) * px, (dz + 20) * px, px + 0.5, px + 0.5);
      }
      const scan = eng.stats.scan;
      const dot = (x: number, z: number, c: string, r = 2) => {
        const mx = ((x / 2 - ptx) + 20.5) * px, mz = ((z / 2 - ptz) + 20.5) * px;
        if (mx < 0 || mz < 0 || mx > S || mz > S) return;
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx, mz, r, 0, 6.3); ctx.fill();
      };
      eng.mine.exits.forEach((e, i) => { if (eng.exitFound[i]) dot(e.x, e.z, e.kind === "elevator" ? "#ffb45a" : "#4fffd8", 3.5); });
      if (scan) for (const ds of eng.deposits) if (ds.alive && ds.d.res && Math.hypot(ds.d.x - eng.p.x, ds.d.z - eng.p.z) < scan) dot(ds.d.x, ds.d.z, RESOURCES[ds.d.res].color, 1.8);
      for (const en of eng.enemies) if (en.state !== "dead" && Math.hypot(en.x - eng.p.x, en.z - eng.p.z) < 16) dot(en.x, en.z, en.boss ? "#ff4fd8" : "#ff4040", en.boss ? 3.5 : 2);
      if (eng.lostPack && !eng.lostPack.taken && eng.explored[Math.floor(eng.lostPack.z / 2) * TW + Math.floor(eng.lostPack.x / 2)]) dot(eng.lostPack.x, eng.lostPack.z, "#ffd36a", 3);
      dot(eng.p.x, eng.p.z, "#fff", 3);
    }, 150);
    return () => clearInterval(id);
  }, [eng]);
  return <canvas ref={ref} width={104} height={104} className="rounded-lg border border-white/25 bg-black/50" />;
}

export function Hud({ eng, snap, input, zoom, onPause, hint }: { eng: Expedition; snap: Snap; input: MutableRefObject<InputRef>; zoom: MutableRefObject<number>; onPause: () => void; hint: string }) {
  const { t, lang } = useGame();
  const joy = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const keys = useRef(new Set<string>());
  const tool = eng.stats.tool;

  // keyboard (desktop testing)
  useEffect(() => {
    const upd = () => {
      const k = keys.current;
      const mx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      const mz = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
      if (!joy.current) { const m = Math.hypot(mx, mz) || 1; input.current.mx = mx / m; input.current.mz = mz / m; }
      input.current.mining = input.current.mining && true;
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { keys.current.add(k); upd(); e.preventDefault(); }
      if (e.repeat) return;
      audio.resume();
      if (k === "e") input.current.mining = true;
      if (k === "x") input.current.extracting = true;
      if (k === "j" || k === " ") { eng.attack(); e.preventDefault(); }
      if (k === "shift") eng.dodge(input.current.mx || undefined, input.current.mz || undefined);
      if (k === "1") eng.ability(0);
      if (k === "2") eng.ability(1);
      if (k === "3") eng.ability(2);
      if (k === "h") eng.useMedkit();
      if (k === "o") eng.useOxygenCan();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.delete(k); upd();
      if (k === "e") input.current.mining = false;
      if (k === "x") input.current.extracting = false;
    };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); input.current.mx = 0; input.current.mz = 0; };
  }, [eng, input]);

  const R = 52;
  const onJoyDown = (e: RPE) => {
    if (joy.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    audio.resume();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    joy.current = { id: e.pointerId, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    setStick({ ox: joy.current.ox, oy: joy.current.oy, x: 0, y: 0 });
  };
  const onJoyMove = (e: RPE) => {
    const j = joy.current; if (!j || j.id !== e.pointerId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dx = e.clientX - rect.left - j.ox, dy = e.clientY - rect.top - j.oy;
    const m = Math.hypot(dx, dy);
    if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
    input.current.mx = dx / R; input.current.mz = dy / R;
    setStick({ ox: j.ox, oy: j.oy, x: dx, y: dy });
  };
  const onJoyUp = (e: RPE) => {
    if (joy.current?.id !== e.pointerId) return;
    joy.current = null; setStick(null); input.current.mx = 0; input.current.mz = 0;
  };

  const near = snap.near;
  const lowO2 = snap.oxygen / snap.maxOxygen < 0.2;
  const canExtract = !!snap.exit && snap.exit.dist < 3.4;
  const cdf = (v: number, max: number) => (v > 0 ? v / max : 0);
  const mineLabel = near ? (near.secret ? (lang === "tr" ? "KIR" : "BREAK") : t("dig")) : t("dig");

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {lowO2 && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: "inset 0 0 90px 20px rgba(255,40,40,.45)" }} />}
      {/* top bar */}
      <div className="absolute left-2 top-2 flex flex-col gap-1">
        <Bar label={t("oxygen")} value={snap.oxygen} max={snap.maxOxygen} color="linear-gradient(90deg,#27b9ff,#7de8ff)" warn={lowO2} />
        <Bar label={t("health")} value={snap.hp} max={snap.maxHp} color="linear-gradient(90deg,#e0243c,#ff6a7a)" warn={snap.hp / snap.maxHp < 0.25} />
        <Bar label={t("energy")} value={snap.energy} max={snap.maxEnergy} color="linear-gradient(90deg,#f0b020,#ffe070)" />
        <Bar label={t("pack")} value={snap.weight} max={snap.capacity} color="linear-gradient(90deg,#8a5a2a,#d9a05a)" warn={snap.weight / snap.capacity > 0.95} />
        {snap.shield > 0 && <div className="text-[11px] font-bold text-sky-300">🛡 {Math.ceil(snap.shield)}</div>}
        <div className="pointer-events-auto mt-1 flex gap-1.5">
          <button className="rounded-full border border-rose-300/60 bg-black/60 px-2.5 py-1 text-xs font-bold text-rose-200 disabled:opacity-40" disabled={snap.carry.medkit <= 0}
            onPointerDown={() => eng.useMedkit()}>✚ {snap.carry.medkit}</button>
          <button className="rounded-full border border-sky-300/60 bg-black/60 px-2.5 py-1 text-xs font-bold text-sky-200 disabled:opacity-40" disabled={snap.carry.oxygenCan <= 0}
            onPointerDown={() => eng.useOxygenCan()}>O₂ {snap.carry.oxygenCan}</button>
        </div>
      </div>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 text-center">
        <div className="rounded-full border border-white/20 bg-black/55 px-4 py-1 text-lg font-black tracking-wide text-amber-100 drop-shadow">{snap.depth.toLocaleString("tr-TR")} m</div>
        <div className="mt-0.5 text-[10px] font-semibold text-white/60">{Math.floor(snap.time / 60)}:{String(Math.floor(snap.time % 60)).padStart(2, "0")} · {tool.name[lang]}</div>
        {snap.boss && (
          <div className="mt-2 w-56">
            <div className="text-xs font-extrabold text-fuchsia-200 drop-shadow">{snap.boss.name[lang]}</div>
            <div className="h-3 overflow-hidden rounded-full border border-fuchsia-300/50 bg-black/60"><div className="h-full bg-gradient-to-r from-fuchsia-600 to-pink-400" style={{ width: `${(snap.boss.hp / snap.boss.max) * 100}%` }} /></div>
          </div>
        )}
      </div>
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
        <Minimap eng={eng} />
        <div className="pointer-events-auto flex gap-1.5">
          <button className="h-8 w-8 rounded-full border border-white/30 bg-black/60 text-sm font-bold text-white" onClick={() => (zoom.current = Math.max(0.7, zoom.current - 0.15))}>＋</button>
          <button className="h-8 w-8 rounded-full border border-white/30 bg-black/60 text-sm font-bold text-white" onClick={() => (zoom.current = Math.min(1.5, zoom.current + 0.15))}>－</button>
          <button className="h-8 w-8 rounded-full border border-white/30 bg-black/60 text-sm font-bold text-white" onClick={onPause}>❚❚</button>
        </div>
        {snap.exit && !canExtract && (
          <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-amber-200">
            <span style={{ display: "inline-block", transform: `rotate(${(Math.atan2(Math.sin(snap.exit.angle), -Math.cos(snap.exit.angle)) * 180) / Math.PI}deg)` }}>▲</span>
            {Math.round(snap.exit.dist)} m
          </div>
        )}
      </div>

      {/* hint */}
      <div className="absolute bottom-[calc(50%-20px)] left-1/2 w-[86%] max-w-md -translate-x-1/2 text-center">
        {hint && <div className="inline-block rounded-xl bg-black/65 px-3 py-1.5 text-xs font-semibold text-amber-100 shadow">{hint}</div>}
        {near && !hint && (
          <div className="inline-block rounded-xl bg-black/65 px-3 py-1.5 text-xs font-semibold text-white shadow">
            {near.secret ? (lang === "tr" ? "Çatlak duvar — kırmak için KIR'a basılı tut" : "Cracked wall — hold BREAK") : near.res ? `${RESOURCES[near.res].name[lang]}${near.locked ? ` — ${lang === "tr" ? "Alet seviyesi" : "Tool level"} ${near.need}+` : ""}` : ""}
            {!near.locked && <div className="mx-auto mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-amber-400" style={{ width: `${(1 - near.ratio) * 100}%` }} /></div>}
          </div>
        )}
        {snap.extractT > 0 && <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-black/60 mx-auto"><div className="h-full bg-teal-300" style={{ width: `${(snap.extractT / 2) * 100}%` }} /></div>}
      </div>

      {/* joystick zone */}
      <div className="pointer-events-auto absolute bottom-0 left-0 h-[48%] w-[48%]" style={{ touchAction: "none" }}
        onPointerDown={onJoyDown} onPointerMove={onJoyMove} onPointerUp={onJoyUp} onPointerCancel={onJoyUp}>
        {!stick && <div className="absolute bottom-10 left-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/25 bg-white/5 text-[10px] font-bold text-white/40">MOVE</div>}
        {stick && (
          <>
            <div className="absolute rounded-full border-2 border-white/40 bg-white/10" style={{ width: 112, height: 112, left: stick.ox - 56, top: stick.oy - 56 }} />
            <div className="absolute rounded-full bg-white/50" style={{ width: 52, height: 52, left: stick.ox - 26 + stick.x, top: stick.oy - 26 + stick.y }} />
          </>
        )}
      </div>

      {/* action cluster */}
      <div className="pointer-events-auto absolute bottom-4 right-3 h-[250px] w-[230px]">
        <div className="absolute bottom-0 right-0"><ActionBtn size={92} label={mineLabel} sub={near && !near.locked ? "basılı tut" : undefined} color="#e8851a" onDown={() => (input.current.mining = true)} onUp={() => (input.current.mining = false)} /></div>
        <div className="absolute bottom-[100px] right-[30px]"><ActionBtn size={74} label={t("attack")} color="#c2304a" cd={cdf(snap.cd.atk, ATTACK_CD)} onDown={() => eng.attack()} /></div>
        <div className="absolute bottom-[14px] right-[104px]"><ActionBtn size={58} label={t("dodge")} color="#3a8fd8" cd={cdf(snap.cd.dodge, DODGE_CD)} onDown={() => eng.dodge(input.current.mx || undefined, input.current.mz || undefined)} /></div>
        {([["⚡", "#e0b020", 0, 104, 92], ["🛡", "#38a8e0", 1, 112, 150], ["✦", "#f0e0a0", 2, 172, 22]] as const).map(([ic, col, i, rx, by]) => (
          <div key={i} className="absolute" style={{ bottom: by, right: rx }}>
            <ActionBtn size={48} label={ic} color={col} cd={cdf(snap.cd.ab[i], ABILITY_CD[i])} onDown={() => eng.ability(i as 0 | 1 | 2)} />
          </div>
        ))}
        <div className="absolute" style={{ bottom: 188, right: 6 }}>
          <ActionBtn size={canExtract ? 62 : 54} label={t("extract")} color={canExtract ? "#18c9a8" : "#555"} disabled={!canExtract} onDown={() => (input.current.extracting = true)} onUp={() => (input.current.extracting = false)} />
        </div>
      </div>
      <div className="absolute bottom-1 left-2 text-[9px] text-white/30">{TOOL_BY_ID[tool.id].name[lang]}</div>
    </div>
  );
}
