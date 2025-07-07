import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { upsertEntity } from "./services/entity.service.js";
import { createActivity } from "./services/activity.service";
import { ActivityPayload } from "./services/activity.service";
import { createResource } from "./services/resource.service";
import { EmbeddingService } from "./embedding/service";
import { ProvenanceBundle } from "@arttribute/eaa-types";
import { ingestBundle } from "./services/bundle.service";
import "dotenv/config";
import { db } from "../db/client";
import { sql } from "drizzle-orm";

const app = new Hono();
app.use("*", cors());

/* health */
app.get("/", (c) => c.text("Replay API up 🚀"));

app.post("/entity", async (c) => {
  const body = await c.req.json();
  await upsertEntity(body);
  return c.json({ ok: true, id: body.id }, 201);
});

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

app.post("/activity", async (c) => {
  const form = await c.req.parseBody();

  if (!(form.file instanceof File))
    return c.json({ error: "file part (name=file) required" }, 400);
  if (typeof form.json !== "string")
    return c.json({ error: "json part (name=json) required" }, 400);

  /* runtime validation with EAA zod */
  const parsed = ActivityPayload.safeParse(JSON.parse(form.json));
  if (!parsed.success)
    return c.json(
      { error: "invalid json payload", details: parsed.error.format() },
      422
    );

  const bytes = new Uint8Array(await form.file.arrayBuffer());

  const result = await createActivity({
    fileBytes: bytes,
    filename: form.file.name,
    mime: form.file.type || "application/octet-stream",
    entity: parsed.data.entity,
    action: parsed.data.action,
  });

  return c.json(result, 201);
});

/* GET /similar/:cid */
const embedder = new EmbeddingService();
app.get("/similar/:cid", async (c) => {
  const cid = c.req.param("cid");
  const topK = Number(c.req.query("topK") ?? 5);
  // fetch existing vector
  const result = await db.execute(
    sql`select embedding from resource where cid=${cid} limit 1`
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
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
