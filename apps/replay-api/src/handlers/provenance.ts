// apps/replay-api/src/routes/provenance.route.ts
import { Hono } from "hono";
import { buildProvenance } from "../services/provenance.service";

export const provenanceRoute = new Hono();

/**
 * GET /provenance/:cid?depth=*
 * - depth (optional, default 10) limits upstream traversal
 */
provenanceRoute.get("/provenance/:cid", async (c) => {
  const cid = c.req.param("cid");
  const depth = Number(c.req.query("depth") ?? 10);

  try {
    const bundle = await buildProvenance(cid, depth);
    return c.json(bundle);
  } catch (err: any) {
    return c.json({ error: err.message ?? String(err) }, 404);
  }
});
