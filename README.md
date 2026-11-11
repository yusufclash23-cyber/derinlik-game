# DERİNLİK — Her kazı yeni bir tehlikeyi açığa çıkarır

3D mobile-first mining / exploration / survival game (WebGL PWA). Developer: **Yusuf SERTKAYA**.
Stack: Next.js 16 · React 19 · TypeScript · Tailwind v4 · Three.js + React Three Fiber + Drei · Drizzle ORM + PostgreSQL · Web Audio.

## Run
```bash
npm install
# DATABASE_URL in .env (postgresql://postgres:postgres@127.0.0.1:5432/app_db)
npx drizzle-kit push        # create/update tables
npm run dev                 # or: npm run build && npm start
npx vitest run              # unit tests (game logic, generator, validator)
npx tsx tests/api-integration.ts   # multi-client API script (needs a running server)
```
Desktop controls: WASD move · hold E dig · J/Space hit · Shift dodge · 1/2/3 abilities · hold X extract · H medkit · O oxygen can. Mobile: floating joystick (left half) + on-screen buttons.

## Structure
```
src/game/   config.ts (all data: resources, tools, gear, biomes, creatures, buildings, techs, missions)
            gen.ts (seeded procedural mines)  engine.ts (headless expedition sim: mining, combat, AI, hazards, oxygen, extraction)
            economy.ts (save schema + validated transactions)  validate.ts (server-side anti-cheat)
            audio.ts (procedural Web Audio)  store.tsx (autosave, sync)  net.ts (network adapter)  i18n.ts
src/render/ Explorer, Creatures (5 models), World (deposits/props/hazards/exits), Terrain (chunk streaming, instancing), MineScene, CampScene
src/ui/     GameApp, Hud, RunView, CampPanels (8 buildings), Screens (mine prep, gear, discoveries, social, settings), shareCard
src/app/api player · player/save · expedition · leaderboard · discoveries · friends · profile · party · party/sync
src/db/schema.ts   players, expeditions, discoveries, friends, parties, party_members, seasons
tests/      game.test.ts (22 tests), api-integration.ts
```

## Implemented
- Camp (3D, 8 buildings, level-driven visuals, upgrades, costs, HQ cap), explorer with visible gear (helmet/armor/backpack/gloves/boots/lantern/tool tiers, suit colors).
- 5 biomes as config; all 5 generate and are playable (unlocked by Elevator level). Deterministic generator with room templates, hidden rooms behind breakable cracked walls, shortcut lift, boss room, hazards (gas, lava, heat, traps, water), props. Validity guaranteed per attempt (reachability, hidden really hidden, deposits never block).
- Mining (tool level, durability, hardness, energy, capacity), 18 resources + smelting, market with daily price drift, warehouse caps (overflow auto-sold 60%).
- Oxygen / energy / backpack / extraction (elevator + shortcut), death: 25% kept, recoverable share dropped as "Lost Pack" in next mine of that biome. Closing the app mid-run forfeits the run's loot.
- 5 creature types + boss per biome, AI (detect/chase/windup/attack/stun), dodge, Quick Strike / Energy Shield / Emergency Flare, medkit, O₂ can.
- Missions (daily/weekly/achievements, titles), research lab, collection index, discovery cinematic + shareable PNG card, history.
- Accounts: guest bearer-token accounts (hash stored), cloud save with revision check, friends (request/accept), profiles, weekly/all-time Depth Race, global discovery records with DB-enforced single "first" per resource, parties (2–4) with shared seed and presence sync.
- PWA manifest + service worker, TR/EN (core UI strings), adaptive quality (auto-detect + FPS monitor), chunk streaming, instancing.

## Server authority (what is and is not authoritative)
- Server re-generates the mine from `(seed, biome)` and validates every expedition report: unknown/duplicate deposits, impossible mining speed, movement speed, depth, kills, hidden-room counts; score is computed only from validated data. `expeditions.id` is the primary key ⇒ duplicate rewards impossible. First-discovery is decided in a locked DB transaction.
- **Not fully authoritative:** the inventory/economy is local-first (offline play) — the server validates results and keeps leaderboards/discoveries honest, but does not hold the player's inventory ledger. A full server-side ledger is a documented next step.

## Incomplete / known limitations (honest list)
- **Co-op sync is position/animation presence only** (HTTP polling ~4 Hz). Mining, creature state, loot and extraction are simulated per client from the shared seed; they are NOT synchronized, and there is no downed-teammate revive. A WebSocket server would be required for that (the Next.js runtime here cannot host one) — `net.ts` + `/api/party/sync` are the adapter boundary to replace.
- Co-op was tested with two scripted API clients (curl-style), not with two real browsers playing simultaneously.
- Real-time competitive mode is architecture-only; the Depth Race is asynchronous.
- No email/password auth (guest tokens only). Only a subset of the 22 requested entities exist as tables (save is JSONB; achievements/missions/equipment are inside the save).
- Seasons table exists but there is no seasonal event content; clans, cosmetic store/season pass, and ads are not implemented (no monetization code at all).
- English localization covers core UI strings and all item names; many panel texts are still Turkish-only.
- Audio is synthesized (no recorded music); boss music is a simple pulse loop.
- Four of five biomes reuse the same room/prop toolkit with different palettes, resources, hazards and creatures; they are thinner in unique content than Old Mines.
- Models are procedural primitives (no GLB), designed to read well but not hand-sculpted. Not tested on physical phones; FPS targets are unmeasured (software-rendered headless Chromium only).
- No APK/AAB/iOS build was produced. Native packaging would use Capacitor around the PWA.

## Test results (executed)
- `npx vitest run`: 22/22 passing (generation determinism + validity over 125 map seeds, mining, capacity, energy, oxygen, extraction, combat, boss, dodge/shield, economy, duplicate-run guard, death/lost pack, offline/clock rollback, missions, report validation).
- Headless Chromium (390×800, touch): title → camp → expedition → mine → combat → extract → result → reload; save persisted, server report accepted, no console errors.
- API script: friends, party create/join/start/permissions, position sync between two accounts, teleport correction, outsider rejection, duplicate/forged report rejection, first-discovery race, leaderboard, cloud-save stale rejection.

## Deployment
Any Node 20+ host with PostgreSQL: set `DATABASE_URL`, run `npx drizzle-kit push`, `npm run build`, `npm start`. HTTPS is required for PWA install and `navigator.share`. For horizontal scaling move the in-memory rate limiter and party presence map to Redis.
