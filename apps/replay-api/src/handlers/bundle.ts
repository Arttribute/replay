// bundle.ts
import { Hono } from "hono";
import { fetchBundle } from "../services/bundle.service.js";

const r = new Hono();

r.get("/bundle/:cid", async (c) => {
  try {
    const bundle = await fetchBundle(c.req.param("cid"));
    return c.json(bundle);
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

export default r;
