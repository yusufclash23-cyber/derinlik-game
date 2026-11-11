"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BIOMES, RARITY_COLOR, RESOURCES, type ResourceId } from "../game/config";
import { Expedition, type Ev } from "../game/engine";
import { computeStats, finishRun, type RunSummary } from "../game/economy";
import { useGame } from "../game/store";
import { api, type RemotePlayer } from "../game/net";
import { MineView, resolveQuality, type InputRef } from "../render/MineScene";
import { Hud } from "./Hud";
import { audio } from "../game/audio";
import { makeDiscoveryCard, shareOrDownload } from "./shareCard";

export interface RunProps { biome: number; seed: number; runId: string; party: { id: string } | null; onDone: () => void }

export function RunView({ biome, seed, runId, party, onDone }: RunProps) {
  const { save, act, commit, toast, lang, L, t, syncReports } = useGame();
  const eng = useMemo(() => {
    const run = save.activeRun;
    return new Expedition({
      seed, biome, stats: computeStats(save), carry: run?.carry ?? { medkit: 0, oxygenCan: 0 }, known: Object.keys(save.collection), runId,
      lostPack: save.lostPack && save.lostPack.biome === biome ? save.lostPack : null,
    });
    // created exactly once per run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const input = useRef<InputRef>({ mx: 0, mz: 0, mining: false, extracting: false });
  const remote = useRef<RemotePlayer[]>([]);
  const zoom = useRef(1);
  const [snap, setSnap] = useState(() => eng.snapshot());
  const [hint, setHintState] = useState(save.tutorialDone ? "" : "Sol yarıyı sürükleyerek yürü. Maden damarına yaklaş ve KAZ'a basılı tut.");
  const hintT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [disc, setDisc] = useState<{ res: ResourceId; depth: number }[]>([]);
  const [ended, setEnded] = useState<{ summary: RunSummary | null; outcome: string; value: number; depth: number; discoveries: { res: ResourceId; depth: number }[]; error?: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const endRef = useRef(false);
  useEffect(() => {
    (window as unknown as { __derinlik?: Expedition }).__derinlik = eng; // debug/QA hook (read-only use in automated tests)
    const tm = setTimeout(() => setHintState(""), 9000);
    return () => { clearTimeout(tm); delete (window as unknown as { __derinlik?: Expedition }).__derinlik; };
  }, [eng]);

  const setHint = useCallback((m: string, ms = 3500) => {
    setHintState(m);
    if (hintT.current) clearTimeout(hintT.current);
    hintT.current = setTimeout(() => setHintState(""), ms);
  }, []);

  const onEvent = useCallback((e: Ev) => {
    switch (e.t) {
      case "weak": if (e.res) setHint(`${L(RESOURCES[e.res].name)} için ${e.n}. seviye alet gerekli`); break;
      case "full": setHint("Çanta dolu! Yüzeye dönüp kaynaklarını sat."); break;
      case "noEnergy": setHint("Enerji yetersiz — bir an dinlen."); break;
      case "hidden": setHint("GİZLİ ODA KEŞFEDİLDİ!", 4000); break;
      case "secret": setHint("Gizli geçit açıldı!", 3000); break;
      case "lostPack": setHint("Kayıp çantanı buldun! Kaynaklar sırtında.", 4000); break;
      case "lowO2": setHint(e.s === "zero" ? "OKSİJEN BİTTİ! Sağlığın azalıyor!" : "Oksijen azalıyor! Yüzeye dön.", 3000); break;
      case "exitFound": if (e.s === "shortcut") setHint("Kısayol asansörü keşfedildi!", 3500); break;
      case "bossStart": setHint("PATRON SAVAŞI!", 3500); break;
      case "bossDead": setHint("Patron yenildi! Ganimetini topla.", 4000); break;
      case "hazard": setHint(e.s === "gas" ? "Zehirli gaz! Oksijen hızla azalıyor." : e.s === "lava" ? "Lav! Hemen uzaklaş." : e.s === "heat" ? "Aşırı sıcak bölge." : e.s === "trap" ? "Tuzak plakası!" : "Sığ su — hareket yavaşladı.", 2500); break;
      case "discover":
        if (e.big && e.res) { eng.paused = true; input.current.mining = false; input.current.mx = 0; input.current.mz = 0; setDisc((d) => [...d, { res: e.res as ResourceId, depth: e.n ?? 0 }]); }
        else if (e.res) toast(`Yeni kaynak keşfedildi: ${L(RESOURCES[e.res].name)}`, "ok");
        break;
    }
  }, [L, eng, setHint, toast]);

  // HUD snapshot + end detection
  useEffect(() => {
    const id = setInterval(() => {
      setSnap(eng.snapshot());
      if (eng.status !== "running" && !endRef.current) {
        endRef.current = true;
        setTimeout(() => {
          const res = eng.result();
          const r = act((s) => finishRun(s, res));
          audio.stopAmbience();
          if (r.ok) setEnded({ summary: r.summary, outcome: res.outcome, value: r.summary.value, depth: Math.floor(res.maxDepth), discoveries: res.discoveries.map((d) => ({ res: d.res, depth: d.depth })) });
          else setEnded({ summary: null, outcome: res.outcome, value: 0, depth: 0, discoveries: [], error: r.error });
          void syncReports();
        }, eng.status === "dead" ? 1800 : 500);
      }
    }, 100);
    return () => clearInterval(id);
  }, [eng, act, syncReports]);

  useEffect(() => { if (!save.tutorialDone) { const tm = setTimeout(() => commit({ ...save, tutorialDone: true }), 20000); return () => clearTimeout(tm); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { audio.resume(); audio.startAmbience(biome); return () => { audio.stopAmbience(); audio.setBoss(false); }; }, [biome]);

  // co-op position sync (HTTP polling adapter; see README for the WebSocket production path)
  useEffect(() => {
    if (!party) return;
    let busy = false;
    const id = setInterval(async () => {
      if (busy) return; busy = true;
      const p = eng.p;
      const a = eng.status === "dead" ? "dead" : p.atkT > 0 ? "attack" : input.current.mining && eng.nearDep !== null ? "mine" : p.moving ? "walk" : "idle";
      const r = await api<{ players: RemotePlayer[] }>("/api/party/sync", { method: "POST", json: { partyId: party.id, x: p.x, z: p.z, f: p.facing, a, hp: p.hp } });
      if (r.ok && r.data.players) remote.current = r.data.players;
      busy = false;
    }, 250);
    return () => clearInterval(id);
  }, [party, eng]);

  const q = resolveQuality(save.settings.quality);
  const closeDisc = () => { setDisc((d) => d.slice(1)); if (disc.length <= 1) eng.paused = false; };
  const setPause = (v: boolean) => { setPaused(v); eng.paused = v || disc.length > 0; if (v) { input.current.mining = false; input.current.extracting = false; } };

  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute inset-0"><MineView eng={eng} input={input} quality={q} lang={lang} onEvent={onEvent} remote={remote} equipped={save.equipped} suit={save.suit} zoom={zoom} /></div>
      <Hud eng={eng} snap={snap} input={input} zoom={zoom} onPause={() => setPause(true)} hint={hint} />
      <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 text-center text-[10px] text-white/40">{BIOMES[biome].name[lang]}{party ? " · Co-op" : ""}</div>

      {paused && !ended && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xs rounded-2xl border border-amber-600/40 bg-stone-900 p-5 text-center">
            <h2 className="text-xl font-black text-amber-200">Duraklatıldı</h2>
            <label className="mt-4 block text-left text-xs text-white/70">{t("music")}
              <input type="range" min={0} max={1} step={0.05} value={save.settings.music} className="w-full" onChange={(e) => { const v = +e.target.value; commit({ ...save, settings: { ...save.settings, music: v } }); }} /></label>
            <label className="block text-left text-xs text-white/70">{t("sfx")}
              <input type="range" min={0} max={1} step={0.05} value={save.settings.sfx} className="w-full" onChange={(e) => { const v = +e.target.value; commit({ ...save, settings: { ...save.settings, sfx: v } }); }} /></label>
            <button className="btn-primary mt-4 w-full" onClick={() => setPause(false)}>Devam Et</button>
            {!confirm ? <button className="btn-ghost mt-2 w-full" onClick={() => setConfirm(true)}>Seferi Bırak</button> : (
              <div className="mt-2 rounded-xl bg-red-950/60 p-3 text-xs text-red-100">Sefer ölüm gibi sayılır: taşıdıkların %25&apos;i kalır, bir kısmı kayıp çantaya düşer.
                <div className="mt-2 flex gap-2"><button className="btn-danger flex-1" onClick={() => { setPause(false); eng.abandon(); }}>{t("confirm")}</button><button className="btn-ghost flex-1" onClick={() => setConfirm(false)}>{t("cancel")}</button></div></div>
            )}
          </div>
        </div>
      )}

      {disc.length > 0 && !ended && <DiscoveryOverlay res={disc[0].res} depth={disc[0].depth} biome={biome} onClose={closeDisc} />}
      {ended && <ResultOverlay ended={ended} onDone={onDone} />}
    </div>
  );
}

function DiscoveryOverlay({ res, depth, biome, onClose }: { res: ResourceId; depth: number; biome: number; onClose: () => void }) {
  const { save, lang, L, t, toast } = useGame();
  const def = RESOURCES[res];
  const [busy, setBusy] = useState(false);
  useEffect(() => { audio.play("discover"); }, []);
  const share = async () => {
    setBusy(true);
    try {
      const blob = await makeDiscoveryCard({ player: save.name, res, depth, biome, status: "pending", at: Date.now(), lang });
      const r = await shareOrDownload(blob, `${save.name} — ${def.name.tr} — ${depth} m | DERİNLİK`);
      toast(r === "shared" ? "Paylaşıldı" : "Kart indirildi", "ok");
    } catch { toast("Kart oluşturulamadı", "err"); }
    setBusy(false);
  };
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-black/85 p-6 text-center">
      <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 spin-slow opacity-50"
        style={{ background: `repeating-conic-gradient(from 0deg, ${def.color}55 0deg 6deg, transparent 6deg 20deg)`, maskImage: "radial-gradient(circle, #000 10%, transparent 65%)", WebkitMaskImage: "radial-gradient(circle, #000 10%, transparent 65%)" }} />
      <div className="relative">
        <div className="pop-in text-sm font-black uppercase tracking-[0.35em]" style={{ color: RARITY_COLOR[def.rarity] }}>{def.rarity === "legendary" || def.rarity === "mythic" ? "Efsanevi Keşif" : "Yeni Keşif"}</div>
        <div className="pop-in mx-auto my-6 h-32 w-32 rotate-45 rounded-2xl" style={{ background: `linear-gradient(135deg, ${def.color}, #ffffff66)`, boxShadow: `0 0 80px 20px ${def.color}aa` }} />
        <div className="pop-in text-3xl font-black text-white drop-shadow-lg">{L(def.name)}</div>
        <div className="mt-2 text-sm text-white/80">{save.name} · {depth.toLocaleString("tr-TR")} m · {L(BIOMES[biome].name)}</div>
        <div className="mt-1 text-[11px] text-white/50">İlk keşif unvanı sefer sonunda sunucu kayıtlarıyla doğrulanır.</div>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn-ghost" onClick={share} disabled={busy}>{busy ? "…" : t("share")}</button>
          <button className="btn-primary" onClick={onClose}>{t("continue")}</button>
        </div>
      </div>
    </div>
  );
}

function ResultOverlay({ ended, onDone }: { ended: { summary: RunSummary | null; outcome: string; value: number; depth: number; discoveries: { res: ResourceId; depth: number }[]; error?: string }; onDone: () => void }) {
  const { L, t } = useGame();
  const ok = ended.outcome === "extracted";
  const s = ended.summary;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-5">
      <div className="pop-in max-h-full w-full max-w-sm overflow-auto rounded-2xl border p-5 text-center" style={{ borderColor: ok ? "#1fc9a8" : "#d84a4a", background: "#12100e" }}>
        <h2 className="text-2xl font-black" style={{ color: ok ? "#6fffd8" : "#ff7a7a" }}>{ok ? t("victory") : t("defeat")}</h2>
        {ended.error && <p className="mt-2 text-sm text-red-300">{ended.error}</p>}
        {s && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Derinlik" v={`${ended.depth} m`} /><Stat label="Altın" v={`+${s.coins}`} /><Stat label="XP" v={`+${s.xp}`} />
            </div>
            <div className="mt-3 rounded-xl bg-white/5 p-3 text-left text-sm">
              <div className="mb-1 text-xs font-bold uppercase text-white/50">{ok ? "Depoya aktarıldı" : "Kurtarılan (%25)"}</div>
              {Object.keys(s.kept).length === 0 && <div className="text-white/40">—</div>}
              {Object.entries(s.kept).map(([k, n]) => <div key={k} className="flex justify-between"><span style={{ color: RARITY_COLOR[RESOURCES[k as ResourceId].rarity] }}>{L(RESOURCES[k as ResourceId].name)}</span><span>×{n}</span></div>)}
            </div>
            {!ok && Object.keys(s.lost).length > 0 && (
              <div className="mt-2 rounded-xl bg-amber-950/50 p-3 text-left text-xs text-amber-100">
                <b>Kayıp Çanta:</b> {Object.entries(s.lost).map(([k, n]) => `${L(RESOURCES[k as ResourceId].name)} ×${n}`).join(", ")}. Aynı bölgeye tekrar inersen haritada bulabilirsin. Kalan {s.destroyed} parça yok oldu.
              </div>
            )}
            {s.levelUp && <div className="mt-2 text-sm font-bold text-amber-300">⬆ Seviye atladın!</div>}
            {ended.discoveries.length > 0 && <div className="mt-2 text-xs text-fuchsia-200">{ended.discoveries.length} keşif Keşifler sekmesinde kayıtlı.</div>}
          </>
        )}
        <button className="btn-primary mt-4 w-full" onClick={onDone}>Kampa Dön</button>
      </div>
    </div>
  );
}
const Stat = ({ label, v }: { label: string; v: string }) => (<div className="rounded-lg bg-white/5 p-2"><div className="text-[10px] uppercase text-white/50">{label}</div><div className="font-bold text-amber-100">{v}</div></div>);
