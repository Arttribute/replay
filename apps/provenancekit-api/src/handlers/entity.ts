// apps/replay-api/src/handlers/entity.ts
import { Hono } from "hono";
import { upsertEntity } from "../services/entity.service.js";
import { ReplayError } from "../errors.js";

const r = new Hono();

/**
 * POST /entity
 * Body: { role: string, name?: string, wallet?: string, publicKey?: string }
 */
r.post("/entity", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (typeof body.role !== "string" || !body.role.trim())
    throw new ReplayError("MissingField", "`role` is required for entity", {
      recovery: "Provide role: human | ai | organization",
    });

  const id = await upsertEntity(body).catch((e) => {
    throw new ReplayError("Internal", "Failed to upsert entity", {
      details: e,
    });
  });

  return c.json({ id }, 201);
});

export default r;
