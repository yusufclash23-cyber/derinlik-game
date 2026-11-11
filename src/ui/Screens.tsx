"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  BIOMES, GEAR, RARITIES, RARITY_COLOR, RARITY_NAME, RESOURCES, RESOURCE_IDS, SLOTS, SLOT_NAME, SUIT_COLORS, TOOLS,
  type Slot, type StatBlock,
} from "../game/config";
import { computeStats, unlockedBiomes, type DiscoveryRecord } from "../game/economy";
import { useGame } from "../game/store";
import { api, getToken, type DiscRow, type LbRow, type PartyState } from "../game/net";
import { Confirm, ResIcon, Row, Sheet, Tabs } from "./kit";
import { makeDiscoveryCard, shareOrDownload } from "./shareCard";
import { resolveQuality } from "../render/MineScene";

const CharacterPreview = dynamic(() => import("../render/CampScene").then((m) => m.CharacterPreview), { ssr: false });

const statText = (s: StatBlock) => [
  s.oxygen && `O₂ +${s.oxygen}`, s.armor && `Zırh +${s.armor}`, s.capacity && `Çanta +${s.capacity}`, s.speed && `Hız +%${Math.round(s.speed * 100)}`,
  s.power && `Güç +%${Math.round(s.power * 100)}`, s.miningSpeed && `Kazı hızı +%${Math.round(s.miningSpeed * 100)}`, s.energy && `Enerji +${s.energy}`,
  s.light && `Işık +${s.light}`, s.heat && `Isı direnci %${Math.round(s.heat * 100)}`, s.hp && `Can +${s.hp}`,
].filter(Boolean).join(" · ") || "Temel ekipman";

/* ============================ MINE PREP ============================ */
export function MinePrep({ onStart }: { onStart: (biome: number, seed: number) => void }) {
  const { save, L, t } = useGame();
  const [sel, setSel] = useState(0);
  const [seedTxt, setSeedTxt] = useState("");
  const st = computeStats(save);
  const unlocked = unlockedBiomes(save);
  const b = BIOMES[sel];
  const lp = save.lostPack;
  return (
    <div className="mx-auto w-full max-w-md p-4 pb-28">
      <h2 className="text-xl font-black text-amber-100">{t("expedition")}</h2>
      {save.activeRun && <div className="my-2 rounded-xl bg-red-950/60 p-3 text-sm text-red-100">Aktif bir sefer kaydı var. Sefer yarıda bırakılmış olabilir.</div>}
      <div className="mt-3 grid gap-2">
        {BIOMES.map((x) => {
          const open = x.index < unlocked;
          return (
            <button key={x.id} onClick={() => open && setSel(x.index)} className={`rounded-2xl border p-3 text-left transition ${sel === x.index ? "border-amber-400 bg-amber-950/40" : "border-white/10 bg-white/5"} ${open ? "" : "opacity-45"}`}
              style={{ backgroundImage: open ? `linear-gradient(90deg, ${x.accent}22, transparent)` : undefined }}>
              <div className="flex items-center justify-between"><span className="font-bold text-white">{L(x.name)}</span><span className="text-xs text-white/50">{x.minDepth}–{x.maxDepth} m</span></div>
              <div className="text-xs text-white/60">{open ? L(x.desc) : `🔒 Asansör seviye ${x.index + 1} gerekli (Kamp → Asansör)`}</div>
              {open && <div className="mt-1 flex gap-1">{x.resources.slice(0, 5).map((r) => <ResIcon key={r.id} id={r.id} size={13} />)}</div>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
        <div className="mb-1 font-bold text-amber-200">Teçhizat Özeti</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span>Alet: {L(st.tool.name)}</span><span>Oksijen: {st.maxOxygen}</span>
          <span>Sağlık: {st.maxHp}</span><span>Enerji: {st.maxEnergy}</span>
          <span>Çanta: {st.capacity}</span><span>Zırh: {st.armor}</span>
          <span>İlk yardım: {Math.min(3, save.consumables.medkit)}</span><span>O₂ tüpü: {Math.min(3, save.consumables.oxygenCan)}</span>
        </div>
        <div className="mt-2 text-white/50">Risk: Sefer sırasında taşıdıkların risk altındadır. Ölürsen %25&apos;i kurtarılır, bir kısmı Kayıp Çanta olarak aynı bölgede beklemeye bırakılır. Depodakiler güvendedir.</div>
        {b.index >= 2 && st.heat < 0.15 && <div className="mt-1 text-orange-300">⚠ Bu bölgede ısı hasarı var — ısı dirençli zırh önerilir.</div>}
        {lp && <div className="mt-2 rounded-lg bg-amber-950/60 p-2 text-amber-100">🎒 Kayıp çantan {L(BIOMES[lp.biome].name)} bölgesinde seni bekliyor.</div>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input className="w-full rounded-lg bg-black/50 p-2 text-sm text-white placeholder:text-white/30" placeholder="Harita tohumu (isteğe bağlı, tekrar oynatmak için)" value={seedTxt} onChange={(e) => setSeedTxt(e.target.value.replace(/\D/g, "").slice(0, 10))} />
      </div>
      <button className="btn-primary mt-3 w-full py-3 text-base" disabled={sel >= unlocked} onClick={() => onStart(sel, seedTxt ? Number(seedTxt) % 4294967296 : Math.floor(Math.random() * 4294967295))}>{t("start")} — {L(b.name)}</button>
      <div className="mt-2 text-center text-[11px] text-white/40">Çok oyunculu sefer için Sosyal → Co-op sekmesini kullan.</div>
    </div>
  );
}

/* ============================ EQUIPMENT ============================ */
export function EquipmentScreen() {
  const { save, act, L, t } = useGame();
  const [slot, setSlot] = useState<Slot | "tool">("helmet");
  const st = computeStats(save);
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      <div className="relative h-[36%] min-h-[190px] shrink-0">
        <CharacterPreview equipped={save.equipped} suit={save.suit} toolId={save.toolEquipped} />
        <div className="absolute right-2 top-2 flex flex-col gap-1">{SUIT_COLORS.map((c) => <button key={c.id} onClick={() => act((s) => ({ ok: true, save: { ...s, suit: c.id } }))} className="h-6 w-6 rounded-full border-2" style={{ background: c.color, borderColor: save.suit === c.id ? "#fff" : "#0006" }} title={L(c.name)} />)}</div>
        <div className="absolute bottom-1 left-2 rounded-lg bg-black/60 p-2 text-[10px] leading-tight text-white/80">
          <div>Oksijen {st.maxOxygen} · Sağlık {st.maxHp}</div><div>Enerji {st.maxEnergy} · Çanta {st.capacity}</div><div>Zırh {st.armor} · Hız {st.speed.toFixed(1)} m/s</div><div>Güç x{st.power.toFixed(2)} · Kazı hızı x{st.speedMult.toFixed(2)}</div>
        </div>
      </div>
      <div className="px-3">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {[...SLOTS, "tool" as const].map((s) => <button key={s} onClick={() => setSlot(s)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${slot === s ? "bg-amber-500 text-black" : "bg-white/10 text-white/80"}`}>{s === "tool" ? "Alet" : L(SLOT_NAME[s])}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-3 pb-28">
        {slot === "tool" ? TOOLS.map((tl) => {
          const own = save.tools.includes(tl.id);
          return (
            <Row key={tl.id} active={save.toolEquipped === tl.id}>
              <div className="flex items-center justify-between gap-2">
                <div><div className="text-sm font-bold" style={{ color: RARITY_COLOR[tl.rarity] }}>{L(tl.name)}</div><div className="text-xs text-white/60">Güç {tl.power} · Hız {tl.speed} · Seviye {tl.level} · {L(tl.bonus)}</div></div>
                {own ? <button className="btn-ghost" disabled={save.toolEquipped === tl.id} onClick={() => act((s) => ({ ok: true, save: { ...s, toolEquipped: tl.id } }))}>{save.toolEquipped === tl.id ? t("equipped") : t("equipBtn")}</button> : <span className="text-[11px] text-white/40">Atölyede üret</span>}
              </div>
            </Row>
          );
        }) : GEAR.filter((g) => g.slot === slot).map((g) => {
          const own = save.gear.includes(g.id), on = save.equipped[g.slot] === g.id;
          return (
            <Row key={g.id} active={on}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="text-sm font-bold" style={{ color: RARITY_COLOR[g.rarity] }}>{L(g.name)} <span className="text-[10px] font-normal text-white/40">{L(RARITY_NAME[g.rarity])}</span></div><div className="text-xs text-white/60">{statText(g.stats)}</div></div>
                {own ? <button className="btn-ghost shrink-0" disabled={on} onClick={() => act((s) => ({ ok: true, save: { ...s, equipped: { ...s.equipped, [g.slot]: g.id } } }))}>{on ? t("equipped") : t("equipBtn")}</button> : <span className="shrink-0 text-[11px] text-white/40">Atölyede üret</span>}
              </div>
            </Row>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ DISCOVERIES ============================ */
export function DiscoveriesScreen() {
  const { save, L, t, lang, toast } = useGame();
  const [tab, setTab] = useState<"col" | "mine" | "global" | "hist">("col");
  const [rows, setRows] = useState<DiscRow[] | null>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(async (scope: string) => {
    setRows(null);
    const r = await api<{ rows: DiscRow[] }>(`/api/discoveries?scope=${scope}`);
    setRows(r.ok ? r.data.rows : []);
  }, []);
  useEffect(() => { if (tab === "global") void load("global"); }, [tab, load]);
  const share = async (d: DiscoveryRecord) => {
    setBusy(d.id);
    try {
      const blob = await makeDiscoveryCard({ player: save.name, res: d.res, depth: d.depth, biome: d.biome, status: d.server === "first" ? "first" : d.server === "recorded" ? "recorded" : "pending", at: d.t, lang });
      const r = await shareOrDownload(blob, `${save.name} — ${RESOURCES[d.res].name.tr} — ${d.depth} m | DERİNLİK`);
      toast(r === "shared" ? "Paylaşıldı" : "Kart indirildi", "ok");
    } catch { toast("Kart oluşturulamadı", "err"); }
    setBusy("");
  };
  const found = Object.keys(save.collection).length;
  return (
    <div className="mx-auto w-full max-w-md p-4 pb-28">
      <Tabs tabs={[{ id: "col", label: t("collection") }, { id: "mine", label: "Keşiflerim" }, { id: "global", label: "Küresel" }, { id: "hist", label: t("history") }]} value={tab} onChange={setTab} />
      {tab === "col" && (
        <>
          <div className="mb-2 text-sm text-white/70">{found}/{RESOURCE_IDS.length} kaynak keşfedildi · En derin: {(save.life.depth ?? 0).toLocaleString("tr-TR")} m · Gizli oda: {save.life.hidden ?? 0} · Patron: {save.life.boss ?? 0}</div>
          <div className="grid grid-cols-3 gap-2">
            {RESOURCE_IDS.map((id) => {
              const d = RESOURCES[id], c = save.collection[id];
              return (
                <div key={id} className={`rounded-xl border p-2 text-center ${c ? "bg-white/5" : "bg-black/30 opacity-60"}`} style={{ borderColor: c ? RARITY_COLOR[d.rarity] + "88" : "#fff2" }}>
                  <div className="mx-auto mb-1 h-9 w-9 rotate-45 rounded-md" style={{ background: c ? `linear-gradient(135deg, ${d.color}, #000a)` : "#222", boxShadow: c && d.glow > 0.8 ? `0 0 14px ${d.color}` : undefined }} />
                  <div className="text-[11px] font-bold text-white">{c ? L(d.name) : "???"}</div>
                  <div className="text-[9px]" style={{ color: RARITY_COLOR[d.rarity] }}>{L(RARITY_NAME[d.rarity])}</div>
                  <div className="text-[9px] text-white/40">{c ? `Kazılan: ${c.count} · 🪙${d.value}` : d.mineable ? "Henüz bulunmadı" : "Ocakta üretilir"}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] text-white/40">Nadirlik sıraları: {RARITIES.map((r) => L(RARITY_NAME[r])).join(" < ")}</div>
        </>
      )}
      {tab === "mine" && (
        <>
          {save.discoveries.length === 0 && <div className="text-sm text-white/50">Henüz kayıtlı keşif yok. Nadir ve üstü kaynakları kazarak keşif kaydı oluştur.</div>}
          {save.discoveries.map((d) => (
            <Row key={d.id}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold" style={{ color: RARITY_COLOR[RESOURCES[d.res].rarity] }}>{L(RESOURCES[d.res].name)}</div>
                  <div className="text-xs text-white/60">{d.depth.toLocaleString("tr-TR")} m · {L(BIOMES[d.biome].name)} · {new Date(d.t).toLocaleDateString("tr-TR")}</div>
                  <div className={`text-[11px] ${d.server === "first" ? "text-emerald-300" : d.server === "rejected" ? "text-red-300" : "text-white/50"}`}>
                    {d.server === "first" ? "🏆 İLK KEŞİF — sunucu doğruladı" : d.server === "recorded" ? "Sunucuda kayıtlı" : d.server === "rejected" ? "Sunucu reddetti" : getToken() ? "Sunucu doğrulaması bekleniyor" : "Çevrimdışı — hesap bağlanınca doğrulanır"}
                  </div>
                </div>
                <button className="btn-ghost shrink-0" disabled={busy === d.id} onClick={() => share(d)}>{busy === d.id ? "…" : t("share")}</button>
              </div>
            </Row>
          ))}
        </>
      )}
      {tab === "global" && (
        <>
          {rows === null && <div className="text-sm text-white/50">{t("loading")}</div>}
          {rows?.length === 0 && <div className="text-sm text-white/50">Henüz küresel kayıt yok veya sunucuya ulaşılamıyor.</div>}
          {rows?.map((r) => (
            <Row key={r.id} active={r.isFirst}>
              <div className="text-sm font-bold" style={{ color: RESOURCES[r.key as keyof typeof RESOURCES] ? RARITY_COLOR[RESOURCES[r.key as keyof typeof RESOURCES].rarity] : "#fff" }}>{r.isFirst ? "🏆 " : ""}{RESOURCES[r.key as keyof typeof RESOURCES] ? L(RESOURCES[r.key as keyof typeof RESOURCES].name) : r.key}</div>
              <div className="text-xs text-white/60">{r.name} · {r.depth.toLocaleString("tr-TR")} m · {new Date(r.at).toLocaleDateString("tr-TR")}</div>
            </Row>
          ))}
        </>
      )}
      {tab === "hist" && (
        <>
          {save.history.length === 0 && <div className="text-sm text-white/50">Henüz sefer yok.</div>}
          {save.history.map((h) => (
            <Row key={h.id}>
              <div className="flex justify-between text-sm"><span className={h.outcome === "extracted" ? "text-emerald-300" : h.outcome === "died" ? "text-red-300" : "text-white/50"}>{h.outcome === "extracted" ? "Başarılı çıkış" : h.outcome === "died" ? "Düştü" : "Yarıda bırakıldı"}</span><span className="text-white/60">{L(BIOMES[h.biome].name)}</span></div>
              <div className="text-xs text-white/60">{h.maxDepth} m · 🪙 değer {h.value} · {Math.floor(h.duration / 60)} dk · {new Date(h.ts).toLocaleString("tr-TR")}</div>
            </Row>
          ))}
        </>
      )}
    </div>
  );
}

/* ============================ SOCIAL ============================ */
interface Fr { friends: { id: string; name: string; code: string }[]; incoming: { id: number; name: string; code: string }[]; outgoing: { id: number; name: string; code: string }[] }
interface Prof { name: string; code: string; expeditions: number; bestDepth: number; bestScore: number; discoveries: number; firsts: number }

export function SocialScreen({ onPartyStart }: { onPartyStart: (p: PartyState) => void }) {
  const { account, online, connect, save, toast, L } = useGame();
  const [tab, setTab] = useState<"rank" | "friends" | "coop">("rank");
  const [scope, setScope] = useState<"weekly" | "alltime">("weekly");
  const [lb, setLb] = useState<LbRow[] | null>(null);
  const [fr, setFr] = useState<Fr | null>(null);
  const [code, setCode] = useState("");
  const [prof, setProf] = useState<Prof | null>(null);
  const [party, setParty] = useState<PartyState | null>(null);
  const [partyCode, setPartyCode] = useState("");
  const [pBiome, setPBiome] = useState(0);
  const connected = !!getToken() && !!account;

  const loadLb = useCallback(async () => { setLb(null); const r = await api<{ rows: LbRow[] }>(`/api/leaderboard?scope=${scope}`); setLb(r.ok ? r.data.rows : []); }, [scope]);
  const loadFr = useCallback(async () => { const r = await api<Fr>("/api/friends"); setFr(r.ok ? r.data : null); }, []);
  const loadParty = useCallback(async () => { const r = await api<{ party: PartyState | null }>("/api/party"); if (r.ok) setParty(r.data.party); }, []);
  useEffect(() => { if (tab === "rank") void loadLb(); }, [tab, loadLb]);
  useEffect(() => { if (tab === "friends" && connected) void loadFr(); }, [tab, connected, loadFr]);
  useEffect(() => {
    if (tab !== "coop" || !connected) return;
    void loadParty();
    const id = setInterval(loadParty, 2000);
    return () => clearInterval(id);
  }, [tab, connected, loadParty]);

  const post = async (path: string, json: unknown, okMsg?: string) => {
    const r = await api<{ error?: string; party?: PartyState | null }>(path, { method: "POST", json });
    if (!r.ok) { toast(r.data.error ?? (r.status === 0 ? "Sunucuya ulaşılamıyor" : "Hata"), "err"); return null; }
    if (okMsg) toast(okMsg, "ok");
    return r.data;
  };
  const unlocked = unlockedBiomes(save);

  return (
    <div className="mx-auto w-full max-w-md p-4 pb-28">
      <div className="mb-3 flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm">
        <div>
          <div className="font-bold text-amber-100">{save.name}{account ? ` · #${account.code}` : ""}</div>
          <div className={`text-xs ${online ? "text-emerald-300" : online === false ? "text-red-300" : "text-white/50"}`}>{online ? "Çevrimiçi" : online === false ? "Çevrimdışı — tek oyunculu mod çalışır" : connected ? "Bağlanıyor…" : "Hesap bağlı değil"}</div>
        </div>
        {!connected && <button className="btn-primary" onClick={async () => { const ok = await connect(); toast(ok ? "Çevrimiçi hesap oluşturuldu" : "Sunucuya bağlanılamadı", ok ? "ok" : "err"); }}>Bağlan</button>}
      </div>
      <Tabs tabs={[{ id: "rank", label: "Sıralama" }, { id: "friends", label: "Arkadaşlar" }, { id: "coop", label: "Co-op" }]} value={tab} onChange={setTab} />

      {tab === "rank" && (
        <>
          <div className="mb-2 flex gap-2"><button className={scope === "weekly" ? "btn-primary flex-1" : "btn-ghost flex-1"} onClick={() => setScope("weekly")}>Haftalık</button><button className={scope === "alltime" ? "btn-primary flex-1" : "btn-ghost flex-1"} onClick={() => setScope("alltime")}>Tüm Zamanlar</button></div>
          <div className="mb-2 text-[11px] text-white/50">Derinlik Yarışı: skor = derinlik + değer + nadir bulgular + gizli odalar + patron + hayatta kalma. Skorlar sunucuda doğrulanır; sahte sonuçlar reddedilir.</div>
          {lb === null && <div className="text-sm text-white/50">Yükleniyor…</div>}
          {lb?.length === 0 && <div className="text-sm text-white/50">Henüz sıralamada kimse yok. İlk sen ol! (Seferi çevrimiçi hesapla tamamla.)</div>}
          {lb?.map((r, i) => (
            <Row key={r.code} active={account?.code === r.code}>
              <div className="flex items-center justify-between"><div><span className="mr-2 text-amber-300">#{i + 1}</span><button className="font-bold text-white underline-offset-2 hover:underline" onClick={async () => { const p = await api<{ profile: Prof }>(`/api/profile?code=${r.code}`); if (p.ok) setProf(p.data.profile); }}>{r.name}</button></div><div className="font-black text-amber-200">{r.score.toLocaleString("tr-TR")}</div></div>
              <div className="text-xs text-white/50">{r.depth} m · değer {r.value}</div>
            </Row>
          ))}
        </>
      )}

      {tab === "friends" && (!connected ? <NeedAccount /> : (
        <>
          <div className="mb-2 rounded-xl bg-white/5 p-3 text-xs text-white/70">Arkadaş kodun: <b className="text-lg text-amber-200">{account?.code}</b></div>
          <div className="mb-3 flex gap-2">
            <input className="w-full rounded-lg bg-black/50 p-2 text-sm uppercase text-white placeholder:text-white/30" placeholder="Arkadaş kodu" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn-primary" onClick={async () => { const r = await post("/api/friends", { code }, "İstek gönderildi"); if (r) { setCode(""); void loadFr(); } }}>Ekle</button>
          </div>
          {fr?.incoming.map((x) => <Row key={x.id}><div className="flex items-center justify-between"><span className="text-sm text-white">{x.name} <span className="text-white/40">#{x.code}</span></span><button className="btn-primary" onClick={async () => { await post("/api/friends", { acceptId: x.id }, "Kabul edildi"); void loadFr(); }}>Kabul</button></div></Row>)}
          {fr?.friends.length === 0 && !fr.incoming.length && <div className="text-sm text-white/50">Henüz arkadaşın yok.</div>}
          {fr?.friends.map((x) => <Row key={x.id}><div className="flex items-center justify-between"><span className="text-sm text-white">{x.name} <span className="text-white/40">#{x.code}</span></span><button className="btn-ghost" onClick={async () => { const p = await api<{ profile: Prof }>(`/api/profile?code=${x.code}`); if (p.ok) setProf(p.data.profile); }}>Profil</button></div></Row>)}
          {fr?.outgoing.map((x) => <div key={x.id} className="text-xs text-white/40">Bekleyen istek: {x.name}</div>)}
        </>
      ))}

      {tab === "coop" && (!connected ? <NeedAccount /> : (
        <>
          <div className="mb-2 rounded-xl bg-amber-950/30 p-3 text-[11px] text-amber-100/80">Co-op (2–4 oyuncu): ortak harita tohumu ve gerçek zamanlı oyuncu konumu eşitlenir. Madenler, yaratıklar ve ödüller her oyuncuda ayrı simüle edilir; ödüller sunucu doğrulamasından geçer. Gerçek oyuncu yoksa kimse gösterilmez.</div>
          {!party ? (
            <>
              <div className="mb-2 flex gap-2">
                <select className="w-full rounded-lg bg-black/50 p-2 text-sm text-white" value={pBiome} onChange={(e) => setPBiome(+e.target.value)}>{BIOMES.slice(0, unlocked).map((b) => <option key={b.id} value={b.index}>{L(b.name)}</option>)}</select>
                <button className="btn-primary shrink-0" onClick={async () => { const r = await post("/api/party", { action: "create", biome: pBiome }, "Parti oluşturuldu"); if (r?.party) setParty(r.party); }}>Parti Kur</button>
              </div>
              <div className="flex gap-2"><input className="w-full rounded-lg bg-black/50 p-2 text-sm uppercase text-white placeholder:text-white/30" placeholder="Parti kodu" value={partyCode} maxLength={6} onChange={(e) => setPartyCode(e.target.value.toUpperCase())} />
                <button className="btn-ghost shrink-0" onClick={async () => { const r = await post("/api/party", { action: "join", code: partyCode }, "Partiye katıldın"); if (r?.party) setParty(r.party); }}>Katıl</button></div>
            </>
          ) : (
            <>
              <Row active>
                <div className="flex justify-between"><span className="text-sm font-bold text-amber-100">Parti kodu: <span className="text-xl tracking-widest">{party.code}</span></span><span className="text-xs text-white/60">{L(BIOMES[party.biome].name)}</span></div>
                <div className="mt-1 text-xs text-white/50">Arkadaşlarına bu kodu ver · Durum: {party.status === "lobby" ? "Lobi" : "Sefer başladı"}</div>
              </Row>
              {party.members.map((m) => <Row key={m.id}><div className="flex justify-between text-sm"><span className="text-white">{m.host ? "👑 " : ""}{m.name}{m.id === party.me ? " (sen)" : ""}</span><span className={m.online ? "text-emerald-300" : "text-white/40"}>{m.online ? "çevrimiçi" : "bağlantı yok"}</span></div></Row>)}
              <div className="mt-2 flex gap-2">
                {party.status === "lobby" && party.hostId === party.me && <button className="btn-primary flex-1" disabled={party.biome >= unlocked} onClick={async () => { const r = await post("/api/party", { action: "start" }); if (r?.party) { setParty(r.party); onPartyStart(r.party); } }}>Seferi Başlat ({party.members.length})</button>}
                {party.status === "active" && <button className="btn-primary flex-1" disabled={party.biome >= unlocked} onClick={() => onPartyStart(party)}>Sefere Katıl</button>}
                {party.status === "lobby" && party.hostId !== party.me && <div className="flex-1 self-center text-center text-xs text-white/50">Kurucunun başlatması bekleniyor…</div>}
                <button className="btn-ghost" onClick={async () => { const r = await post("/api/party", { action: "leave" }); if (r) setParty(null); }}>Ayrıl</button>
              </div>
              {party.biome >= unlocked && <div className="mt-1 text-xs text-red-300">Bu bölge sende kilitli.</div>}
            </>
          )}
        </>
      ))}
      {prof && (
        <Sheet title={`${prof.name} #${prof.code}`} onClose={() => setProf(null)}>
          <div className="grid grid-cols-2 gap-2 text-sm">{[["Sefer", prof.expeditions], ["En derin", `${prof.bestDepth} m`], ["En iyi skor", prof.bestScore], ["Keşif", prof.discoveries], ["İlk keşif", prof.firsts]].map(([k, v]) => <div key={k as string} className="rounded-lg bg-white/5 p-2"><div className="text-[10px] uppercase text-white/50">{k}</div><div className="font-bold text-amber-100">{v}</div></div>)}</div>
        </Sheet>
      )}
    </div>
  );
}
const NeedAccount = () => <div className="rounded-xl bg-white/5 p-4 text-sm text-white/60">Bu özellik için çevrimiçi hesap gerekir. Yukarıdaki &quot;Bağlan&quot; düğmesine bas (misafir hesabı, e-posta gerekmez).</div>;

/* ============================ SETTINGS ============================ */
export function SettingsSheet({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const { save, commit, t, account, online } = useGame();
  const [conf, setConf] = useState(false);
  const set = (p: Partial<typeof save.settings>) => commit({ ...save, settings: { ...save.settings, ...p } });
  return (
    <Sheet title={t("settings")} onClose={onClose}>
      <label className="block text-xs text-white/70">{t("music")} <input type="range" min={0} max={1} step={0.05} className="w-full" value={save.settings.music} onChange={(e) => set({ music: +e.target.value })} /></label>
      <label className="mt-2 block text-xs text-white/70">{t("sfx")} <input type="range" min={0} max={1} step={0.05} className="w-full" value={save.settings.sfx} onChange={(e) => set({ sfx: +e.target.value })} /></label>
      <label className="mt-3 block text-xs text-white/70">{t("quality")} <span className="text-white/40">(otomatik → {resolveQuality("auto")})</span>
        <select className="mt-1 w-full rounded-lg bg-black/50 p-2 text-sm text-white" value={save.settings.quality} onChange={(e) => set({ quality: e.target.value as typeof save.settings.quality })}>
          <option value="auto">Otomatik</option><option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option></select></label>
      <label className="mt-3 block text-xs text-white/70">{t("language")}
        <select className="mt-1 w-full rounded-lg bg-black/50 p-2 text-sm text-white" value={save.settings.lang} onChange={(e) => set({ lang: e.target.value as "tr" | "en" })}><option value="tr">Türkçe</option><option value="en">English</option></select></label>
      <label className="mt-3 block text-xs text-white/70">Oyuncu adı
        <input className="mt-1 w-full rounded-lg bg-black/50 p-2 text-sm text-white" maxLength={24} value={save.name} onChange={(e) => commit({ ...save, name: e.target.value.slice(0, 24) || "Kâşif" })} /></label>
      <div className="mt-3 text-xs text-white/50">Hesap: {account ? `#${account.code} (${online ? "çevrimiçi" : "çevrimdışı"})` : "bağlı değil"}</div>
      <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-white/60">DERİNLİK — {t("subtitle")}<br />{t("developer")}: Yusuf SERTKAYA<br />Kontroller (masaüstü): WASD yürü · E kaz (basılı) · J/Boşluk vur · Shift kaç · 1/2/3 yetenek · X çıkış · H ilk yardım · O oksijen</div>
      <button className="btn-danger mt-3 w-full" onClick={() => setConf(true)}>Kaydı Sıfırla</button>
      {conf && <Confirm text="Tüm ilerleme (yerel kayıt) silinecek. Bu işlem geri alınamaz. Emin misin?" onYes={() => { setConf(false); onReset(); }} onNo={() => setConf(false)} />}
    </Sheet>
  );
}
