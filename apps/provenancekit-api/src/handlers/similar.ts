// apps/replay-api/src/handlers/similar.ts
import { Hono } from "hono";
import { EmbeddingService } from "../embedding/service.js";
import { db } from "../../db/client.js";
import { sql } from "drizzle-orm";
import { ReplayError } from "../errors.js";

const embedder = new EmbeddingService();
const r = new Hono();

/**
 * GET /similar/:cid?topK=5
 */
r.get("/similar/:cid", async (c) => {
  const cid = c.req.param("cid");
  const topK = Number(c.req.query("topK") ?? 5);

  if (!cid) throw new ReplayError("MissingField", "cid path param required");

  const row = (
    await db.execute(
      sql`SELECT embedding FROM resource WHERE cid=${cid} LIMIT 1`
    )
  )[0];

  if (!row) throw new ReplayError("NotFound", "Resource not found");

  if (!row.embedding)
    throw new ReplayError("Unsupported", "Resource has no embedding");

  const matches = await embedder.match(row.embedding as number[], { topK });
  return c.json(matches);
});

export default r;
