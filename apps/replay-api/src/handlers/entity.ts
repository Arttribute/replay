// entity.ts
import { Hono } from "hono";
import { upsertEntity } from "../services/entity.service";

const r = new Hono();

r.post("/entity", async (c) => {
  const body = await c.req.json();
  const id = await upsertEntity(body);
  return c.json({ id });
});

export default r;
