import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const makeCode = (n = 6) => Array.from(randomBytes(n), (b) => ALPHA[b % ALPHA.length]).join("");

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function authPlayer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer ([a-f0-9]{64})$/.exec(h);
  if (!m) return null;
  const rows = await db.select().from(players).where(eq(players.tokenHash, hashToken(m[1]))).limit(1);
  return rows[0] ?? null;
}

type G = typeof globalThis & { __dRate?: Map<string, number[]> };
/** Tiny in-memory sliding-window rate limiter (per server instance; use Redis when scaling horizontally). */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const g = globalThis as G;
  const map = (g.__dRate ??= new Map());
  const now = Date.now();
  const arr = (map.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (arr.length >= max) { map.set(key, arr); return false; }
  arr.push(now);
  map.set(key, arr);
  return true;
}
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
