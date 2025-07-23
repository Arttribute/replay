// apps/replay-api/src/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import health from "./handlers/health.js";
import entity from "./handlers/entity.js";
import activity from "./handlers/activity.js";
import bundle from "./handlers/bundle.js";
import similar from "./handlers/similar.js";
import sessionRoutes from "./handlers/session.js";
import { provenanceRoute } from "./handlers/provenance.js";
import graph from "./handlers/graph.js";
import { searchRoute } from "./handlers/search.js";

import { toProvenanceKitError } from "./errors.js";

const app = new Hono();
app.use("*", cors());

app.route("/", health);
app.route("/", entity);
app.route("/", activity);
app.route("/", bundle);
app.route("/", similar);
app.route("/", provenanceRoute);
app.route("/", graph);
app.route("/", searchRoute);
app.route("/", sessionRoutes);

/* -------- central error formatter --------------------------------- */
app.onError((err, c) => {
  const e = toProvenanceKitError(err);
  return c.json(
    {
      error: {
        code: e.code,
        message: e.message,
        recovery: e.recovery,
        details: e.details,
      },
    },
    e.status as any
  );
});

serve({ fetch: app.fetch, port: 3001 }, ({ port }) =>
  console.log(`Replay API 🚀  http://localhost:${port}`)
);
