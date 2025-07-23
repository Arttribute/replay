// apps/provenancekit-api/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vector } from "drizzle-orm/pg-core";

/* ───────── NEW: session tables ───────── */
export const session = pgTable("session", {
  sessionId: uuid("session_id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  title: text("title"),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .default(sql`timezone('utc', now())`),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const sessionMessage = pgTable("session_message", {
  messageId: uuid("message_id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => session.sessionId),
  entityId: text("entity_id").references(() => entity.entityId), // NEW
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`timezone('utc', now())`),
});

/* ───────── EXISTING tables (unchanged names) ───────── */

export const entity = pgTable("entity", {
  entityId: text("entity_id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  role: text("role").notNull(),
  name: text("name"),
  wallet: text("wallet"),
  publicKey: text("public_key"),
  metadata: jsonb("metadata"),
  extensions: jsonb("extensions"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`timezone('utc', now())`)
    .notNull(),
});

export const resource = pgTable("resource", {
  cid: text("cid")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  size: integer("size").notNull(),
  algorithm: text("algorithm").notNull(),
  type: text("type").notNull(),
  locations: jsonb("locations").notNull().$type<any>(),
  createdBy: text("created_by").notNull(),
  rootAction: text("root_action").notNull(),
  license: text("license"),
  embedding: vector("embedding", { dimensions: 768 }),
  extensions: jsonb("extensions"),
  sessionId: uuid("session_id").references(() => session.sessionId),
});

export const action = pgTable("action", {
  actionId: text("action_id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  type: text("type").notNull(),
  performedBy: text("performed_by").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  inputCids: jsonb("input_cids").$type<string[]>(),
  outputCids: jsonb("output_cids").$type<string[]>(),
  toolUsed: text("tool_used"),
  proof: text("proof"),
  extensions: jsonb("extensions"),
  sessionId: uuid("session_id").references(() => session.sessionId),
});

export const attribution = pgTable("attribution", {
  id: text("attribution_id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  resourceCid: text("resource_cid").notNull(),
  entityId: text("entity_id").notNull(),
  role: text("role").notNull(),
  weight: integer("weight"),
  includedRev: boolean("included_rev").default(false),
  includedAttr: boolean("included_attr").default(true),
  note: text("note"),
  extensions: jsonb("extensions"),
});
