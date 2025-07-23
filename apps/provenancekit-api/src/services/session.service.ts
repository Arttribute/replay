// apps/provenancekit-api/src/services/session.service.ts
import { db } from "../../db/client.js";
import { session, sessionMessage, action, resource } from "../../db/schema.js";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ProvenanceKitError } from "../errors.js";

export async function createSession(title?: string, metadata?: any) {
  const id = uuidv4();
  await db.insert(session).values({
    sessionId: id,
    title: title ?? null,
    metadata: metadata ?? null,
  });
  return id;
}

export async function closeSession(id: string) {
  await db
    .update(session)
    .set({ endedAt: new Date() })
    .where(sql`session_id = ${id}`);
}

export async function assertSessionOpen(id: string) {
  const [s] = await db
    .select()
    .from(session)
    .where(sql`session_id = ${id}`)
    .limit(1);
  if (!s) throw new ProvenanceKitError("NotFound", "Session not found");
  if (s.endedAt)
    throw new ProvenanceKitError("Unsupported", "Session is closed", {
      recovery: "Create a new session or reopen it",
      details: { sessionId: id },
    });
}

export async function addSessionMessage(opts: {
  sessionId: string;
  entityId?: string; // may be undefined for pure system messages
  content: any;
}) {
  await assertSessionOpen(opts.sessionId);

  const id = uuidv4();
  console.log(`Adding message ${id} to session ${opts.sessionId}`);
  await db.insert(sessionMessage).values({
    messageId: id,
    sessionId: opts.sessionId,
    entityId: opts.entityId ?? null,
    content: opts.content,
  });
  return id;
}

export async function getSession(id: string) {
  const [s] = await db
    .select()
    .from(session)
    .where(sql`session_id = ${id}`)
    .limit(1);
  if (!s) throw new ProvenanceKitError("NotFound", "Session not found");

  const msgs = await db
    .select()
    .from(sessionMessage)
    .where(sql`session_id = ${id}`)
    .orderBy(sql`created_at asc`);

  const acts = await db
    .select()
    .from(action)
    .where(sql`session_id = ${id}`)
    .orderBy(sql`timestamp asc`);

  const resRows = await db
    .select()
    .from(resource)
    .where(sql`session_id = ${id}`);

  return { session: s, messages: msgs, actions: acts, resources: resRows };
}
