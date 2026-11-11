import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { authPlayer, clientIp, hashToken, json, makeCode, newToken, rateLimit } from "@/server/util";

export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().trim().min(1).max(24) });

/** Create a guest account. Returns the bearer token ONCE; only its hash is stored. */
export async function POST(req: Request) {
  if (!rateLimit("reg:" + clientIp(req), 10, 60_000)) return json({ error: "rate limited" }, 429);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid name" }, 400);
  const token = newToken();
  for (let i = 0; i < 5; i++) {
    try {
      const [p] = await db.insert(players).values({ tokenHash: hashToken(token), name: body.data.name, code: makeCode(6) }).returning({ id: players.id, name: players.name, code: players.code });
      return json({ token, player: p });
    } catch { /* code collision -> retry */ }
  }
  return json({ error: "could not create account" }, 500);
}

export async function GET(req: Request) {
  const p = await authPlayer(req);
  if (!p) return json({ error: "unauthorized" }, 401);
  return json({ player: { id: p.id, name: p.name, code: p.code }, save: p.save ?? null, revision: p.revision });
}
