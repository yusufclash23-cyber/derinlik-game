import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { authPlayer, json, rateLimit } from "@/server/util";

export const dynamic = "force-dynamic";

const Body = z.object({ save: z.record(z.string(), z.unknown()), revision: z.number().int().min(0) });

/** Cloud save. Last-writer-wins by monotonically increasing revision; stale revisions are rejected. */
export async function PUT(req: Request) {
  const p = await authPlayer(req);
  if (!p) return json({ error: "unauthorized" }, 401);
  if (!rateLimit("save:" + p.id, 30, 60_000)) return json({ error: "rate limited" }, 429);
  const raw = await req.text();
  if (raw.length > 300_000) return json({ error: "too large" }, 413);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }
  const body = Body.safeParse(parsed);
  if (!body.success) return json({ error: "invalid" }, 400);
  if (body.data.revision <= p.revision) return json({ ok: false, revision: p.revision, error: "stale" }, 409);
  const name = typeof body.data.save.name === "string" ? body.data.save.name.slice(0, 24) : p.name;
  await db.update(players).set({ save: body.data.save, revision: body.data.revision, name, updatedAt: new Date() }).where(eq(players.id, p.id));
  return json({ ok: true, revision: body.data.revision });
}
