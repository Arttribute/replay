import { Hono } from "hono";
import { createActivity } from "../services/activity.service.js";

const r = new Hono();

r.post("/activity", async (c) => {
  const form = await c.req.parseBody();
  if (!(form.file instanceof File) || typeof form.json !== "string")
    return c.json({ error: "multipart file & json required" }, 400);

  const json = JSON.parse(form.json);
  const result = await createActivity(form.file, json);
  return c.json(result, 201);
});

export default r;
