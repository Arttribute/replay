import { Hono } from "hono";
import { buildProvenanceGraph } from "../services/graph.service.js";

export const graphRoute = new Hono();

/**
 * GET /graph/:cid?depth=10
 * Returns a nodes+edges provenance graph in JSON.
 */
graphRoute.get("/graph/:cid", async (c) => {
  const cid = c.req.param("cid");
  const depth = Number(c.req.query("depth") ?? 10);

  try {
    const graph = await buildProvenanceGraph(cid, depth);
    return c.json(graph);
  } catch (err: any) {
    return c.json({ error: err.message ?? String(err) }, 404);
  }
});
