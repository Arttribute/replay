import { ProvenanceBundle } from "@arttribute/eaa-types";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { EmbeddingService } from "./embedding/service.js";
import { ingestBundle } from "./services/bundle.service.js";
import { createResource } from "./services/resource.service.js";
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

const app = new Hono();
app.use("*", cors());

/* health */
app.get("/", (c) => c.text("Replay API up 🚀"));

/* POST /resource (multipart OR raw bytes) */
app.post("/resource", async (c) => {
	const createdBy = c.req.query("createdBy") ?? "unknown";
	const rootAction = c.req.query("rootAction") ?? "upload";
	const file = await c.req.parseBody();
	if (!file.file) return c.json({ error: "file required" }, 400);
	if (!(file.file instanceof File)) {
		return c.json({ error: "Invalid file type" }, 400);
	}
	const bytes = new Uint8Array(await file.file.arrayBuffer());
	const res = await createResource({
		data: bytes,
		filename: file.file.name,
		type: "image",
		createdBy,
		rootAction,
		mime: "",
	});
	return c.json(res, 201);
});

/* GET /similar/:cid */
const embedder = new EmbeddingService();
app.get("/similar/:cid", async (c) => {
	const cid = c.req.param("cid");
	const topK = Number(c.req.query("topK") ?? 5);
	// fetch existing vector
	const result = await db.execute(
		sql`select embedding from resource where cid=${cid} limit 1`,
	);
	const row = result[0];
	if (!row?.embedding) return c.json([], 200);
	const matches = await embedder.match(row.embedding as number[], { topK });
	return c.json(matches.matches);
});

/* POST /bundle */
app.post("/bundle", async (c) => {
	const b = ProvenanceBundle.parse(await c.req.json());
	await ingestBundle(b);
	return c.json({ ok: true });
});

serve(
	{
		fetch: app.fetch,
		port: process.env.PORT ? parseInt(process.env.PORT) || 3000 : 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
