import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import health from "./handlers/health";
import entity from "./handlers/entity";
import activity from "./handlers/activity";
import bundle from "./handlers/bundle";
import similar from "./handlers/similar";

const app = new Hono();
app.use("*", cors());

app.route("/", health);
app.route("/", entity);
app.route("/", activity);
app.route("/", bundle);
app.route("/", similar);

serve({ fetch: app.fetch, port: 3000 }, ({ port }) =>
  console.log(`Replay API 🚀  http://localhost:${port}`)
);
