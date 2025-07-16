// apps/replay-api/src/handlers/provenance.ts
import { Hono } from "hono";
import { buildProvenance } from "../services/provenance.service.js";
import { ReplayError } from "../errors.js";

const r = new Hono();

/**
 * GET /provenance/:cid?depth=10
 */
r.get("/provenance/:cid", async (c) => {
  const cid = c.req.param("cid");
  const depthRaw = c.req.query("depth") ?? "10";
  const depth = Number(depthRaw);

  if (!cid) throw new ReplayError("MissingField", "cid path param required");

  if (Number.isNaN(depth) || depth < 0)
    throw new ReplayError("InvalidField", "`depth` must be a positive number");

  try {
    const bundle = await buildProvenance(cid, depth);
    return c.json(bundle);
  } catch (e: any) {
    if (e.message === "resource not found")
      throw new ReplayError("NotFound", "Resource not found");
    throw e;
  }
});

export const provenanceRoute = r;
