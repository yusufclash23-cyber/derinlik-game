"use client";
import { useCallback, useEffect, useState } from "react";
import type { BuildingId } from "../game/config";
import { levelOf, startRun } from "../game/economy";
import { GameProvider, useGame } from "../game/store";
import { audio } from "../game/audio";
import type { PartyState } from "../game/net";
import { setToken } from "../game/net";
import { CampView } from "../render/CampScene";
import { resolveQuality } from "../render/MineScene";
import { BuildingSheet } from "./CampPanels";
import { DiscoveriesScreen, EquipmentScreen, MinePrep, SettingsSheet, SocialScreen } from "./Screens";
import { RunView } from "./RunView";

type Tab = "camp" | "mine" | "equip" | "disc" | "social";
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

export default function GameApp() {
  return <GameProvider><Shell /></GameProvider>;
}

function Shell() {
  const { save, ready, hasSave, t, lang, startNew, toasts, act, online } = useGame();
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<Tab>("camp");
  const [sheet, setSheet] = useState<BuildingId | null>(null);
  const [run, setRun] = useState<{ biome: number; seed: number; runId: string; party: { id: string } | null } | null>(null);
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => { if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_MOBILE) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);

  const beginRun = useCallback((biome: number, seed: number, party: { id: string } | null) => {
    audio.resume();
    const runId = uid();
    const r = act((s) => startRun(s, biome, seed, runId));
    if (r.ok) setRun({ biome, seed, runId, party });
  }, [act]);
  const onPartyStart = (p: PartyState) => beginRun(p.biome, p.seed, { id: p.id });

  const reset = () => {
    try { localStorage.removeItem("derinlik.save.v1"); } catch { /* ignore */ }
    setToken(null);
    location.reload();
  };

  if (!ready) return <div className="fixed inset-0 flex items-center justify-center bg-[#0a0c18] text-amber-200"><div className="text-center"><div className="spin-slow mx-auto mb-3 h-10 w-10 rotate-45 rounded-md bg-amber-400" /><div>{t("loading")}</div></div></div>;

  if (!started) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#3a1d10,#0a0c18_70%)] p-6 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "repeating-conic-gradient(from 0deg at 50% 38%, #ffb45a22 0deg 4deg, transparent 4deg 18deg)" }} />
        <div className="relative">
          <div className="mx-auto mb-4 h-20 w-20 rotate-45 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-700 shadow-[0_0_80px_20px_rgba(255,150,50,.5)]" />
          <h1 className="text-5xl font-black tracking-[0.15em] text-amber-100 drop-shadow-[0_4px_20px_rgba(255,150,50,.6)]">DERİNLİK</h1>
          <p className="mt-2 text-sm font-semibold text-amber-200/80">{t("subtitle")}</p>
          {!hasSave ? (
            <div className="mx-auto mt-8 w-72">
              <input className="w-full rounded-xl border border-amber-700/50 bg-black/50 p-3 text-center text-white placeholder:text-white/30" placeholder="Kâşif adın" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn-primary mt-3 w-full py-3 text-base" onClick={() => { audio.resume(); startNew(name || "Kâşif"); setStarted(true); }}>{t("tapToStart")}</button>
            </div>
          ) : (
            <div className="mx-auto mt-8 w-72">
              <div className="mb-3 text-sm text-white/70">Hoş geldin, <b className="text-amber-200">{save.name}</b> · {t("level")} {levelOf(save.xp)}</div>
              <button className="btn-primary w-full py-3 text-base" onClick={() => { audio.resume(); setStarted(true); }}>Devam Et</button>
            </div>
          )}
          <div className="mt-10 text-[11px] text-white/40">{t("developer")}: Yusuf SERTKAYA</div>
        </div>
        <ToastLayer />
      </div>
    );
  }

  if (run) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black text-white">
        <RunView {...run} onDone={() => { setRun(null); setTab("camp"); }} />
        <ToastLayer />
      </div>
    );
  }

  const nav: { id: Tab; icon: string; label: string }[] = [
    { id: "camp", icon: "⛺", label: t("camp") }, { id: "mine", icon: "⛏", label: t("mine") }, { id: "equip", icon: "🎒", label: t("equip") },
    { id: "disc", icon: "💎", label: t("discoveries") }, { id: "social", icon: "👥", label: t("social") },
  ];
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0c18] text-white">
      {tab === "camp" && <div className="absolute inset-0"><CampView save={save} lang={lang} quality={resolveQuality(save.settings.quality)} onSelect={(id) => { audio.resume(); audio.play("ui"); setSheet(id); }} /></div>}
      {tab !== "camp" && <div className="absolute inset-x-0 bottom-[68px] top-[52px] overflow-auto bg-gradient-to-b from-[#12131f] to-[#0a0c18]">
        {tab === "mine" && <MinePrep onStart={(b, s) => beginRun(b, s, null)} />}
        {tab === "equip" && <EquipmentScreen />}
        {tab === "disc" && <DiscoveriesScreen />}
        {tab === "social" && <SocialScreen onPartyStart={onPartyStart} />}
      </div>}
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex h-[52px] items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-amber-600/50 bg-black/60 px-3 py-1 text-sm font-bold text-amber-200">🪙 {save.coins.toLocaleString("tr-TR")}</div>
          <div className="rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white/80">{save.name} · {t("level")} {levelOf(save.xp)}</div>
        </div>
        <div className="flex items-center gap-2">
          {online === false && <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[10px] font-bold text-red-100">{t("offline")}</span>}
          <button className="h-9 w-9 rounded-full border border-white/25 bg-black/60 text-lg" onClick={() => setSettings(true)} aria-label={t("settings")}>⚙</button>
        </div>
      </div>
      {tab === "camp" && <div className="pointer-events-none absolute inset-x-0 bottom-[76px] z-10 text-center text-[11px] text-white/50">Binalara dokun · sürükleyerek döndür · yakınlaştır</div>}
      {/* bottom nav */}
      <nav className="absolute inset-x-0 bottom-0 z-20 flex h-[68px] items-stretch border-t border-amber-900/40 bg-black/85 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {nav.map((n) => (
          <button key={n.id} onClick={() => { audio.play("ui"); audio.resume(); setTab(n.id); }} className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${tab === n.id ? "text-amber-300" : "text-white/55"}`}>
            <span className={`text-xl ${tab === n.id ? "scale-110" : ""}`}>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      {sheet && <BuildingSheet id={sheet} onClose={() => setSheet(null)} goMine={() => setTab("mine")} />}
      {settings && <SettingsSheet onClose={() => setSettings(false)} onReset={reset} />}
      <ToastLayer />
    </div>
  );
}

function ToastLayer() {
  const { toasts } = useGame();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[60] flex flex-col items-center gap-1.5 px-4">
      {toasts.map((x) => (
        <div key={x.id} className={`pop-in max-w-sm rounded-xl border px-4 py-2 text-sm font-semibold shadow-xl ${x.kind === "err" ? "border-red-500/60 bg-red-950/90 text-red-100" : x.kind === "ok" ? "border-emerald-500/50 bg-emerald-950/90 text-emerald-100" : "border-amber-600/50 bg-stone-900/95 text-amber-100"}`}>{x.msg}</div>
      ))}
    </div>
  );
}
