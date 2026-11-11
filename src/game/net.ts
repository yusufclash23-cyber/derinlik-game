/**
 * Network adapter. All online features go through this module so the transport can be
 * swapped (current: HTTPS + polling; production target: dedicated WebSocket game server).
 */
import type { ExpeditionReport, Save } from "./economy";

const TOKEN_KEY = "derinlik.token";
/** Boş = aynı origin (web). Mobil APK için derleme sırasında NEXT_PUBLIC_API_BASE verilir (ör. https://oyun.example.com). */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string | null) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const tok = getToken();
  if (tok) headers.authorization = `Bearer ${tok}`;
  try {
    const res = await fetch(API_BASE + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

export interface Me { id: string; name: string; code: string }
export interface ReportReply { ok: boolean; score?: number; discoveries?: { key: string; isFirst: boolean }[]; error?: string; duplicate?: boolean }

export const registerGuest = (name: string) => api<{ token: string; player: Me }>("/api/player", { method: "POST", json: { name } });
export const fetchMe = () => api<{ player: Me; save: Save | null; revision: number }>("/api/player");
export const pushSave = (save: Save) => api<{ ok: boolean; revision: number }>("/api/player/save", { method: "PUT", json: { save, revision: save.revision } });
export const sendReport = (r: ExpeditionReport) => api<ReportReply>("/api/expedition", { method: "POST", json: r });

export interface LbRow { name: string; code: string; score: number; depth: number; value: number; at: string }
export interface DiscRow { id: number; name: string; key: string; depth: number; isFirst: boolean; at: string }
export interface PartyState {
  id: string; code: string; hostId: string; seed: number; biome: number; status: "lobby" | "active" | "closed";
  members: { id: string; name: string; host: boolean; online: boolean }[]; me: string;
}
export interface RemotePlayer { id: string; name: string; x: number; z: number; f: number; a: string; hp: number }
