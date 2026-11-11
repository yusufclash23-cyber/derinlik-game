import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** Guest account + PlayerProfile. Authentication = random bearer token; only its SHA-256 hash is stored. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // shareable friend code
  save: jsonb("save"), // cloud copy of the player save (camp, inventory, equipment, settings)
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Server-validated expedition results (ExpeditionSeed lives in seed/biome; MineRoom is derived deterministically). */
export const expeditions = pgTable("expeditions", {
  id: text("id").primaryKey(), // client-generated run id — primary key => duplicate rewards impossible
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  seed: bigint("seed", { mode: "number" }).notNull(),
  biome: integer("biome").notNull(),
  outcome: text("outcome").notNull(),
  maxDepth: integer("max_depth").notNull(),
  value: integer("value").notNull(),
  rare: integer("rare").notNull().default(0),
  hidden: integer("hidden").notNull().default(0),
  bossKill: boolean("boss_kill").notNull().default(false),
  durationSec: integer("duration_sec").notNull(),
  score: integer("score").notNull(),
  week: text("week").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("exp_week_score").on(t.week, t.score), index("exp_player").on(t.playerId)]);

/** Global discovery records. `isFirst` is decided by the server inside a locked transaction. */
export const discoveries = pgTable("discoveries", {
  id: serial("id").primaryKey(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  expeditionId: text("expedition_id").notNull().references(() => expeditions.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  depth: integer("depth").notNull(),
  isFirst: boolean("is_first").notNull().default(false),
  week: text("week").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // partial unique index: only ONE row per key may have is_first = true (DB-level guarantee)
}, (t) => [uniqueIndex("disc_first_key").on(t.key).where(sql`is_first = true`), index("disc_week").on(t.week)]);

export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  friendId: uuid("friend_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | accepted
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("friend_pair").on(t.playerId, t.friendId)]);

export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  hostId: uuid("host_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  seed: bigint("seed", { mode: "number" }).notNull(),
  biome: integer("biome").notNull(),
  status: text("status").notNull().default("lobby"), // lobby | active | closed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partyMembers = pgTable("party_members", {
  partyId: uuid("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.partyId, t.playerId] })]);

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
});
