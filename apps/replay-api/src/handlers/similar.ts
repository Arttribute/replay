// similar.ts
import { Hono } from "hono";
import { EmbeddingService } from "../embedding/service.js";
import { db } from "../../db/client.js";
import { sql } from "drizzle-orm";

const embedder = new EmbeddingService();
const r = new Hono();

r.get("/similar/:cid", async (c) => {
  const { cid } = c.req.param();
  const row = (
    await db.execute(
      sql`select embedding from resource where cid=${cid} limit 1`
    )
  )[0];
  if (!row?.embedding) return c.json([], 200);
  const matches = await embedder.match(row.embedding as number[], {
    topK: Number(c.req.query("topK") ?? 5),
  });
  return c.json(matches);
});

export default r;
