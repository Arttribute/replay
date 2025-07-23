// apps/provenancekit-api/src/handlers/session.ts
import { Hono } from "hono";
import {
  createSession,
  closeSession,
  addSessionMessage,
  getSession,
} from "../services/session.service.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/* POST /session  {title?, metadata?} */
r.post("/session", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = await createSession(body.title, body.metadata).catch((e) => {
    throw new ProvenanceKitError("Internal", "Failed to create session", {
      details: e,
    });
  });
  return c.json({ id }, 201);
});

/* POST /session/:id/message  {entityId?, content} */
r.post("/session/:id/message", async (c) => {
  const id = c.req.param("id");
  if (!id)
    throw new ProvenanceKitError("MissingField", "session id required", {
      recovery: "POST /session first",
    });

  const body = await c.req.json().catch(() => ({}));
  if (body.content === undefined)
    throw new ProvenanceKitError("MissingField", "`content` required");

  const mid = await addSessionMessage({
    sessionId: id,
    entityId: typeof body.entityId === "string" ? body.entityId : undefined,
    content: body.content,
  }).catch((e) => {
    throw new ProvenanceKitError("Internal", "Failed to add message", {
      details: e,
    });
  });

  return c.json({ messageId: mid }, 201);
});

/* POST /session/:id/close */
r.post("/session/:id/close", async (c) => {
  const id = c.req.param("id");
  if (!id) throw new ProvenanceKitError("MissingField", "session id required");
  await closeSession(id).catch((e) => {
    throw new ProvenanceKitError("Internal", "Failed to close session", {
      details: e,
    });
  });
  return c.json({ ok: true });
});

/* GET /session/:id */
r.get("/session/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw new ProvenanceKitError("MissingField", "session id required");
  try {
    const data = await getSession(id);
    return c.json(data);
  } catch (e: any) {
    if (e instanceof ProvenanceKitError) throw e;
    throw new ProvenanceKitError("Internal", "Failed to fetch session", {
      details: e,
    });
  }
});

export default r;
