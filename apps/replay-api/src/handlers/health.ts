// health.ts
import { Hono } from "hono";
const r = new Hono().get("/", (c) => c.text("ok"));
export default r;
