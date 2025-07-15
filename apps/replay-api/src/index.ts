import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import health from "./handlers/health.js";
import entity from "./handlers/entity.js";
import activity from "./handlers/activity.js";
import bundle from "./handlers/bundle.js";
import similar from "./handlers/similar.js";
import { provenanceRoute } from "./handlers/provenance.js";
import { graphRoute } from "./handlers/graph.js";
import { searchRoute } from "./handlers/search.js";

const app = new Hono();
app.use("*", cors());

app.route("/", health);
app.route("/", entity);
app.route("/", activity);
app.route("/", bundle);
app.route("/", similar);
app.route("/", provenanceRoute);
app.route("/", graphRoute);
app.route("/", searchRoute);

serve(
  {
    fetch: app.fetch,
    port: process.env.PORT ? parseInt(process.env.PORT) || 3000 : 3000,
  },
  ({ port }) => console.log(`Replay API 🚀  http://localhost:${port}`)
);
