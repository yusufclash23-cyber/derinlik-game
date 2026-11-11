"use client";
import type { ReactNode } from "react";
import { RARITY_COLOR, RESOURCES, type Cost, type ResourceId } from "../game/config";
import type { Save } from "../game/economy";
import { useGame } from "../game/store";

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useGame();
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className={`slide-up flex max-h-[88%] w-full flex-col rounded-t-3xl border border-amber-700/40 bg-gradient-to-b from-stone-900 to-stone-950 shadow-2xl sm:rounded-3xl ${wide ? "max-w-2xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-black text-amber-100">{title}</h2>
          <button className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/80" onClick={onClose}>{t("close")}</button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function ResIcon({ id, size = 16 }: { id: ResourceId; size?: number }) {
  const d = RESOURCES[id];
  return <span className="inline-block shrink-0 rounded-[4px] align-middle" style={{ width: size, height: size, background: `linear-gradient(135deg, ${d.color}, #000a)`, boxShadow: d.glow > 0.8 ? `0 0 8px ${d.color}` : undefined, border: `1px solid ${RARITY_COLOR[d.rarity]}` }} />;
}

export function CostView({ cost, save }: { cost: Cost; save: Save }) {
  const { t, L } = useGame();
  if (cost.coins === 0 && !cost.res) return <span className="text-xs text-white/50">{t("free")}</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {cost.coins > 0 && <span className={save.coins >= cost.coins ? "text-amber-200" : "text-red-400"}>🪙 {cost.coins.toLocaleString("tr-TR")}</span>}
      {Object.entries(cost.res ?? {}).map(([k, n]) => {
        const have = save.stash[k] ?? 0, ok = have >= (n ?? 0);
        return <span key={k} className={ok ? "text-emerald-200" : "text-red-400"}><ResIcon id={k as ResourceId} size={11} /> {L(RESOURCES[k as ResourceId].name)} {have}/{n}</span>;
      })}
    </div>
  );
}

export function Row({ children, active }: { children: ReactNode; active?: boolean }) {
  return <div className={`mb-2 rounded-xl border p-3 ${active ? "border-amber-500/70 bg-amber-950/30" : "border-white/10 bg-white/5"}`}>{children}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-3 flex gap-1 rounded-xl bg-black/40 p-1">
      {tabs.map((x) => <button key={x.id} onClick={() => onChange(x.id)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${value === x.id ? "bg-amber-600 text-black" : "text-white/70"}`}>{x.label}</button>)}
    </div>
  );
}

export function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  const { t } = useGame();
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onNo}>
      <div className="w-full max-w-xs rounded-2xl border border-amber-600/40 bg-stone-900 p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-white/90">{text}</p>
        <div className="mt-4 flex gap-2"><button className="btn-primary flex-1" onClick={onYes}>{t("confirm")}</button><button className="btn-ghost flex-1" onClick={onNo}>{t("cancel")}</button></div>
      </div>
    </div>
  );
}
