// apps/replay-api/src/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { toProvenanceKitError } from "./errors.js";
import activity from "./handlers/activity.js";
import bundle from "./handlers/bundle.js";
import entity from "./handlers/entity.js";
import graph from "./handlers/graph.js";
import health from "./handlers/health.js";
import { provenanceRoute } from "./handlers/provenance.js";
import { searchRoute } from "./handlers/search.js";
import similar from "./handlers/similar.js";

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
		e.status as any,
	);
});

serve(
	{ fetch: app.fetch, port: parseInt(process.env.PORT || "3000") || 3000 },
	({ port }) => console.log(`Replay API 🚀  http://localhost:${port}`),
);
