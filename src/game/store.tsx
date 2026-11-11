"use client";
/**
 * Game store: save state (local-first, autosave), offline handling, server sync and toasts.
 * Business rules live in ./economy; this file only wires them to React + persistence.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyOffline, newSave, normalizeSave, type Result, type Save } from "./economy";
import { fetchMe, getToken, pushSave, registerGuest, sendReport, setToken, type Me } from "./net";
import { pick, tr, type Key, type Lang } from "./i18n";
import type { L10n } from "./config";
import { audio } from "./audio";

const KEY = "derinlik.save.v1";
export interface Toast { id: number; msg: string; kind: "ok" | "err" | "info" }
interface Ctx {
  save: Save; ready: boolean; hasSave: boolean; lang: Lang; t: (k: Key) => string; L: (l: L10n) => string;
  act: <T extends object>(fn: (s: Save) => Result<T>, okMsg?: string) => (Result<T>);
  commit: (s: Save) => void; toast: (msg: string, kind?: Toast["kind"]) => void; toasts: Toast[];
  account: Me | null; online: boolean | null; connect: (name?: string) => Promise<boolean>; syncReports: () => Promise<void>;
  startNew: (name: string) => void;
}
const GameCtx = createContext<Ctx | null>(null);
export const useGame = () => {
  const c = useContext(GameCtx);
  if (!c) throw new Error("GameProvider missing");
  return c;
};

export function GameProvider({ children }: { children: ReactNode }) {
  const [save, setSaveState] = useState<Save>(() => newSave());
  const ref = useRef<Save>(save);
  const [ready, setReady] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [account, setAccount] = useState<Me | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const tid = useRef(0);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const scheduleSync = useCallback(() => {
    if (!getToken()) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      const r = await pushSave(ref.current);
      setOnline(r.status !== 0);
    }, 4000);
  }, []);

  const commit = useCallback((s: Save) => {
    const next = { ...s, revision: s.revision + 1, lastSeen: Date.now() };
    ref.current = next;
    setSaveState(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full / private mode */ }
    scheduleSync();
  }, [scheduleSync]);

  const act = useCallback(<T extends object>(fn: (s: Save) => Result<T>, okMsg?: string): Result<T> => {
    const r = fn(ref.current);
    if (r.ok) { commit(r.save); if (okMsg) toast(okMsg, "ok"); audio.play("buy"); }
    else { toast(r.error, "err"); audio.play("error"); }
    return r;
  }, [commit, toast]);

  const syncReports = useCallback(async () => {
    if (!getToken()) return;
    let s = ref.current;
    if (!s.pendingReports.length) return;
    for (const rep of s.pendingReports.slice()) {
      const r = await sendReport(rep);
      if (r.status === 0) { setOnline(false); return; }
      setOnline(true);
      // processed (accepted OR rejected as invalid OR duplicate) => remove from queue, update discovery status
      s = { ...s, pendingReports: s.pendingReports.filter((x) => x.id !== rep.id) };
      const d = r.data;
      s = { ...s, discoveries: s.discoveries.map((x) => {
        if (!x.id.startsWith(rep.id + ":")) return x;
        const hit = d.discoveries?.find((q) => q.key === x.res);
        return { ...x, server: r.ok ? (hit?.isFirst ? "first" : "recorded") : "rejected" } as typeof x;
      }) };
    }
    commit(s);
  }, [commit]);

  const connect = useCallback(async (name?: string) => {
    if (!getToken()) {
      const r = await registerGuest(name ?? ref.current.name);
      if (!r.ok) { setOnline(r.status === 0 ? false : null); return false; }
      setToken(r.data.token);
      setAccount(r.data.player);
      setOnline(true);
      await pushSave(ref.current);
      return true;
    }
    const me = await fetchMe();
    if (!me.ok) { if (me.status === 401) setToken(null); setOnline(me.status === 0 ? false : null); return false; }
    setAccount(me.data.player); setOnline(true);
    return true;
  }, []);

  // boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: Save | null = null;
      try { const raw = localStorage.getItem(KEY); if (raw) s = normalizeSave(JSON.parse(raw)); } catch { s = null; }
      if (s) {
        const off = applyOffline(s);
        s = off.save;
        setHasSave(true);
        if (off.abandoned) setTimeout(() => toast("Önceki sefer yarıda bırakıldı: taşıdığın kaynaklar kayboldu.", "err"), 800);
        if (off.income > 0) setTimeout(() => toast(`Kamp çalışanları ${off.income} altın biriktirdi.`, "ok"), 1400);
      }
      if (cancelled) return;
      if (s) { ref.current = s; setSaveState(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
      setReady(true);
      if (getToken()) {
        const me = await fetchMe();
        if (me.ok) {
          setAccount(me.data.player); setOnline(true);
          const server = me.data.save ? normalizeSave(me.data.save) : null;
          if (server && server.revision > ref.current.revision && !ref.current.activeRun) { ref.current = server; setSaveState(server); localStorage.setItem(KEY, JSON.stringify(server)); }
          void syncReports();
        } else { if (me.status === 401) setToken(null); setOnline(me.status === 0 ? false : null); }
      }
    })();
    return () => { cancelled = true; };
  }, [toast, syncReports]);

  // connectivity indicators + flush on regain
  useEffect(() => {
    const on = () => { setOnline(null); void connect().then(() => syncReports()); };
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...ref.current, lastSeen: Date.now() })); } catch { /* ignore */ } };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("pagehide", save); };
  }, [connect, syncReports]);

  const lang = save.settings.lang;
  useEffect(() => { audio.setVolumes(save.settings.music, save.settings.sfx); }, [save.settings.music, save.settings.sfx]);

  const startNew = useCallback((name: string) => {
    const s = newSave(name.trim() || "Kâşif");
    commit(s);
    setHasSave(true);
    void connect(s.name);
  }, [commit, connect]);

  const value = useMemo<Ctx>(() => ({
    save, ready, hasSave, lang, t: (k) => tr(lang, k), L: (l) => pick(lang, l), act, commit, toast, toasts, account, online, connect, syncReports, startNew,
  }), [save, ready, hasSave, lang, act, commit, toast, toasts, account, online, connect, syncReports, startNew]);
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
