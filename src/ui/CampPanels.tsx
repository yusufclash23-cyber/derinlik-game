"use client";
import { useState } from "react";
import { BASE, BIOMES, BUILDINGS, GEAR, MISSIONS, RESOURCES, SLOTS, SLOT_NAME, SMELT, TECHS, TOOLS, RARITY_COLOR, type BuildingId, type MissionDef, type ResourceId } from "../game/config";
import {
  buyConsumable, canAfford, claimMission, craftGear, craftTool, dailyMissions, levelOf, marketPrice, missionClaimed, missionProgress,
  nextBuildingCost, research, sell, sellAll, smelt, stashCap, upgradeBuilding, weeklyMissions, xpForLevel,
} from "../game/economy";
import { useGame } from "../game/store";
import { Confirm, CostView, ResIcon, Row, Sheet, Tabs } from "./kit";

export function BuildingSheet({ id, onClose, goMine }: { id: BuildingId; onClose: () => void; goMine: () => void }) {
  const { save, act, L, t, lang } = useGame();
  const def = BUILDINGS[id];
  const lvl = save.buildings[id];
  const cost = nextBuildingCost(save, id);
  const needHq = id !== "hq" && cost && lvl >= save.buildings.hq + 0 && lvl + 1 - 1 > save.buildings.hq;
  return (
    <Sheet title={`${L(def.name)} · ${lvl === 0 ? (lang === "tr" ? "İnşa edilmedi" : "Not built") : `${lang === "tr" ? "Seviye" : "Level"} ${lvl}`}`} onClose={onClose} wide={id === "trading" || id === "workshop"}>
      <p className="mb-3 text-sm text-white/70">{L(def.desc)}</p>
      <Row>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-amber-100">{cost ? (lvl === 0 ? t("build") : `${t("upgrade")} → ${lvl + 1}`) : t("maxLevel")}</div>
            {cost && <CostView cost={cost} save={save} />}
            {needHq && <div className="text-xs text-red-300">Karargâh seviye {lvl} gerekli</div>}
          </div>
          {cost && <button className="btn-primary shrink-0" disabled={!canAfford(save, cost)} onClick={() => act((s) => upgradeBuilding(s, id), `${L(def.name)} ${lvl === 0 ? "inşa edildi" : "yükseltildi"}!`)}>{lvl === 0 ? t("build") : t("upgrade")}</button>}
        </div>
      </Row>
      {id === "hq" && <HqBody />}
      {id === "workshop" && lvl > 0 && <WorkshopBody />}
      {id === "furnace" && lvl > 0 && <FurnaceBody />}
      {id === "warehouse" && <WarehouseBody />}
      {id === "lab" && lvl > 0 && <LabBody />}
      {id === "trading" && <TradingBody />}
      {id === "elevator" && (
        <>
          <div className="mb-2 text-xs font-bold uppercase text-white/50">Erişilebilir Bölgeler</div>
          {BIOMES.map((b) => (
            <Row key={b.id} active={b.index < lvl}>
              <div className="flex justify-between text-sm"><span className={b.index < lvl ? "text-amber-100" : "text-white/40"}>{L(b.name)}</span><span className="text-xs text-white/50">{b.minDepth}–{b.maxDepth} m</span></div>
              {b.index >= lvl && <div className="text-[11px] text-white/40">Asansör seviye {b.index + 1} gerekli</div>}
            </Row>
          ))}
          <button className="btn-primary mt-2 w-full" onClick={() => { onClose(); goMine(); }}>Sefere Hazırlan</button>
        </>
      )}
      {id === "medical" && lvl > 0 && (
        <>
          <Row>
            <div className="text-sm text-white/80">Maks. sağlık bonusu: +{lvl * 10} · İlk yardım iyileştirmesi: {30 + lvl * 12 + 10}</div>
          </Row>
          {([["medkit", "İlk Yardım Çantası", BASE.medkitCost], ["oxygenCan", "Oksijen Tüpü (+90 O₂)", BASE.oxygenCost]] as const).map(([k, name, price]) => (
            <Row key={k}>
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-bold text-amber-100">{name}</div><div className="text-xs text-white/60">Stokta: {save.consumables[k]} · Sefere en fazla {k === "medkit" ? BASE.carryMedkit : BASE.carryOxygen} taşınır · 🪙 {price}</div></div>
                <button className="btn-primary" disabled={save.coins < price || save.consumables[k] >= 9} onClick={() => act((s) => buyConsumable(s, k), "Satın alındı")}>Al</button>
              </div>
            </Row>
          ))}
        </>
      )}
    </Sheet>
  );
}

function HqBody() {
  const { save, act, L, lang } = useGame();
  const [tab, setTab] = useState<"info" | "daily" | "weekly" | "ach">("info");
  const now = Date.now();
  const lv = levelOf(save.xp);
  const into = save.xp - xpForLevel(lv), need = xpForLevel(lv + 1) - xpForLevel(lv);
  const list: MissionDef[] = tab === "daily" ? dailyMissions(now) : tab === "weekly" ? weeklyMissions(now) : MISSIONS.filter((m) => m.kind === "ach");
  return (
    <>
      <Tabs tabs={[{ id: "info", label: "Genel" }, { id: "daily", label: "Günlük" }, { id: "weekly", label: "Haftalık" }, { id: "ach", label: "Başarımlar" }]} value={tab} onChange={setTab} />
      {tab === "info" && (
        <>
          <Row>
            <div className="text-sm font-bold text-amber-100">Kâşif {save.name} — Seviye {lv}</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/50"><div className="h-full bg-amber-400" style={{ width: `${(into / need) * 100}%` }} /></div>
            <div className="mt-1 text-xs text-white/50">{into}/{need} XP · Çevrimdışı gelir: saatte {15 * save.buildings.hq} 🪙 (en çok 8 saat)</div>
          </Row>
          <Row>
            <div className="text-xs text-white/60">Unvan</div>
            <select className="mt-1 w-full rounded-lg bg-black/50 p-2 text-sm text-white" value={save.title} onChange={(e) => act((s) => ({ ok: true, save: { ...s, title: e.target.value } }))}>
              <option value="">—</option>{save.titles.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Row>
        </>
      )}
      {tab !== "info" && list.map((m) => {
        const p = missionProgress(save, m), done = p >= m.target, claimed = missionClaimed(save, m);
        return (
          <Row key={m.id} active={done && !claimed}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-100">{L(m.name)}</div>
                <div className="text-xs text-white/60">{p}/{m.target} · 🪙 {m.reward.coins ?? 0} · {m.reward.xp ?? 0} XP{m.reward.title ? ` · 🏅 ${m.reward.title}` : ""}{m.reward.res ? ` · ${Object.entries(m.reward.res).map(([k, n]) => `${n} ${L(RESOURCES[k as ResourceId].name)}`).join(", ")}` : ""}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/50"><div className="h-full bg-emerald-400" style={{ width: `${(p / m.target) * 100}%` }} /></div>
              </div>
              <button className="btn-primary shrink-0" disabled={!done || claimed} onClick={() => act((s) => claimMission(s, m.id), lang === "tr" ? "Ödül alındı!" : "Reward claimed!")}>{claimed ? "✓" : lang === "tr" ? "Al" : "Claim"}</button>
            </div>
          </Row>
        );
      })}
    </>
  );
}

function WorkshopBody() {
  const { save, act, L, t } = useGame();
  const ws = save.buildings.workshop;
  return (
    <>
      <div className="mb-2 text-xs font-bold uppercase text-white/50">Aletler</div>
      {TOOLS.map((tl) => {
        const owned = save.tools.includes(tl.id);
        return (
          <Row key={tl.id} active={save.toolEquipped === tl.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold" style={{ color: RARITY_COLOR[tl.rarity] }}>{L(tl.name)}</div>
                <div className="text-xs text-white/60">Güç {tl.power} · Hız {tl.speed} · Enerji {tl.energy}/vuruş · Seviye {tl.level} · {L(tl.bonus)}</div>
                {!owned && <CostView cost={tl.cost} save={save} />}
                {!owned && tl.level > ws && <div className="text-xs text-red-300">Atölye seviye {tl.level} gerekli</div>}
              </div>
              {owned ? <button className="btn-ghost shrink-0" disabled={save.toolEquipped === tl.id} onClick={() => act((s) => ({ ok: true, save: { ...s, toolEquipped: tl.id } }))}>{save.toolEquipped === tl.id ? t("equipped") : t("equipBtn")}</button>
                : <button className="btn-primary shrink-0" disabled={tl.level > ws || !canAfford(save, tl.cost)} onClick={() => act((s) => craftTool(s, tl.id), `${L(tl.name)} üretildi!`)}>{t("craft")}</button>}
            </div>
          </Row>
        );
      })}
      <div className="mb-2 mt-4 text-xs font-bold uppercase text-white/50">Ekipman (Kademe ≤ Atölye seviyesi)</div>
      {SLOTS.map((slot) => (
        <div key={slot}>
          <div className="mb-1 mt-2 text-xs font-bold text-amber-200">{L(SLOT_NAME[slot])}</div>
          {GEAR.filter((g) => g.slot === slot && g.tier > 0).map((g) => {
            const owned = save.gear.includes(g.id);
            return (
              <Row key={g.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold" style={{ color: RARITY_COLOR[g.rarity] }}>{L(g.name)} <span className="text-[10px] text-white/40">T{g.tier}</span></div>
                    {!owned && <CostView cost={g.cost} save={save} />}
                    {!owned && g.tier > ws && <div className="text-xs text-red-300">Atölye seviye {g.tier} gerekli</div>}
                  </div>
                  {owned ? <span className="text-xs text-emerald-300">✓ Sahipsin</span> : <button className="btn-primary shrink-0" disabled={g.tier > ws || !canAfford(save, g.cost)} onClick={() => act((s) => craftGear(s, g.id), `${L(g.name)} üretildi ve kuşanıldı!`)}>{t("craft")}</button>}
                </div>
              </Row>
            );
          })}
        </div>
      ))}
    </>
  );
}

function FurnaceBody() {
  const { save, act, L } = useGame();
  const lvl = save.buildings.furnace;
  return (
    <>
      <div className="mb-2 text-xs text-white/60">Seviye bonusu: her dökümde +%{(lvl - 1) * 15} ek külçe.</div>
      {SMELT.map((r) => {
        const max = Math.min(Math.floor((save.stash[r.input] ?? 0) / r.need), Math.floor((save.stash.coal ?? 0) / r.coal));
        return (
          <Row key={r.id}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-amber-100"><ResIcon id={r.out} /> {L(RESOURCES[r.out].name)}</div>
                <div className="text-xs text-white/60">{r.need}× {L(RESOURCES[r.input].name)} + {r.coal}× Kömür → 1 külçe · Yapılabilir: {max}</div>
              </div>
              <div className="flex gap-1">
                <button className="btn-primary" disabled={max < 1} onClick={() => act((s) => smelt(s, r.id, 1), "Eritildi")}>×1</button>
                <button className="btn-ghost" disabled={max < 1} onClick={() => act((s) => smelt(s, r.id, max), "Hepsi eritildi")}>Hepsi</button>
              </div>
            </div>
          </Row>
        );
      })}
    </>
  );
}

function WarehouseBody() {
  const { save, L } = useGame();
  const cap = stashCap(save);
  const items = Object.entries(save.stash);
  return (
    <>
      <div className="mb-2 text-xs text-white/60">Kaynak başına kapasite: {cap}. Taşan miktar otomatik %60 fiyatla satılır.</div>
      {items.length === 0 && <div className="text-sm text-white/40">Depo boş.</div>}
      {items.map(([k, n]) => (
        <Row key={k}><div className="flex justify-between text-sm"><span style={{ color: RARITY_COLOR[RESOURCES[k as ResourceId].rarity] }}><ResIcon id={k as ResourceId} /> {L(RESOURCES[k as ResourceId].name)}</span><span>{n}/{cap}</span></div></Row>
      ))}
    </>
  );
}

function LabBody() {
  const { save, act, L } = useGame();
  return (
    <>
      {TECHS.map((tc) => {
        const owned = save.techs.includes(tc.id);
        const locked = save.buildings.lab < tc.lab || (tc.requires && !save.techs.includes(tc.requires));
        return (
          <Row key={tc.id} active={owned}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-100">{L(tc.name)}</div>
                <div className="text-xs text-white/60">{L(tc.desc)}</div>
                {!owned && <CostView cost={tc.cost} save={save} />}
                {!owned && locked && <div className="text-xs text-red-300">Lab seviye {tc.lab}{tc.requires ? ` + önkoşul` : ""} gerekli</div>}
              </div>
              {owned ? <span className="text-xs text-emerald-300">✓</span> : <button className="btn-primary shrink-0" disabled={!!locked || !canAfford(save, tc.cost)} onClick={() => act((s) => research(s, tc.id), "Araştırıldı!")}>Araştır</button>}
            </div>
          </Row>
        );
      })}
    </>
  );
}

function TradingBody() {
  const { save, act, L, t } = useGame();
  const [conf, setConf] = useState(false);
  const now = Date.now();
  const items = Object.entries(save.stash) as [ResourceId, number][];
  const total = items.reduce((a, [k, n]) => a + marketPrice(save, k, now) * n, 0);
  return (
    <>
      <div className="mb-2 flex items-center justify-between text-xs text-white/60"><span>Fiyatlar günlük dalgalanır · bonus: +%{Math.round(((1 + 0.05 * (save.buildings.trading - 1)) * (1 + (save.techs.includes("sell1") ? 0.05 : 0)) - 1) * 100)}</span><span>🪙 {save.coins.toLocaleString("tr-TR")}</span></div>
      {items.length === 0 && <div className="text-sm text-white/40">Satacak kaynak yok. Maden seferine çık!</div>}
      {items.map(([k, n]) => {
        const price = marketPrice(save, k, now), base = RESOURCES[k].value;
        return (
          <Row key={k}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold" style={{ color: RARITY_COLOR[RESOURCES[k].rarity] }}><ResIcon id={k} /> {L(RESOURCES[k].name)} ×{n}</div>
                <div className="text-xs text-white/60">Fiyat: 🪙 {price} <span className={price >= base ? "text-emerald-300" : "text-red-300"}>{price >= base ? "▲" : "▼"}</span></div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost" onClick={() => act((s) => sell(s, k, 1, now))}>1</button>
                <button className="btn-primary" onClick={() => act((s) => sell(s, k, n, now), `+${price * n} altın`)}>{t("sell")} ({n})</button>
              </div>
            </div>
          </Row>
        );
      })}
      {items.length > 0 && <button className="btn-primary mt-2 w-full" onClick={() => setConf(true)}>{t("sellAll")} (🪙 {total.toLocaleString("tr-TR")})</button>}
      {conf && <Confirm text={`Depodaki tüm kaynaklar ${total.toLocaleString("tr-TR")} altına satılsın mı? Üretimde kullanacağın malzemeler de satılır.`} onYes={() => { setConf(false); act((s) => sellAll(s, now), "Hepsi satıldı"); }} onNo={() => setConf(false)} />}
    </>
  );
}
