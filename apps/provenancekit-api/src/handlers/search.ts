// apps/provenanceKit-api/src/handlers/search.ts
import { Hono } from "hono";
import { searchByFile, searchByText } from "../services/search.service.js";
import { inferKindFromMime } from "../utils.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/*--------------------------------------------------------------
  POST /search/file
  multipart: file=<binary>
--------------------------------------------------------------*/
r.post("/search/file", async (c) => {
  const topK = Number(c.req.query("topK") ?? 5);
  const min = Number(c.req.query("min") ?? 0);
  const overrideType = c.req.query("type");

  const form = await c.req.parseBody();
  if (!(form.file instanceof File))
    throw new ProvenanceKitError("MissingField", "`file` part required");

  const kind = overrideType || inferKindFromMime(form.file.type);
  if (!kind)
    throw new ProvenanceKitError(
      "Unsupported",
      `Cannot infer kind from mime ${form.file.type}`,
      {
        recovery: "Specify ?type=image|audio|text|video",
      }
    );

  const result = await searchByFile(form.file, {
    type: kind,
    topK,
    minScore: min,
  }).catch((e) => {
    throw new ProvenanceKitError(
      "EmbeddingFailed",
      "Embedding generation failed",
      {
        details: e,
      }
    );
  });

  return c.json(result);
});

/*--------------------------------------------------------------
  POST /search/text
  body: { text: "...", type?: "...", topK?: n, minScore?: n }
--------------------------------------------------------------*/
r.post("/search/text", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (typeof body.text !== "string" || !body.text.trim())
    throw new ProvenanceKitError("MissingField", "`text` is required in body");

  const result = await searchByText(body.text, {
    type: typeof body.type === "string" ? body.type : undefined,
    topK: typeof body.topK === "number" ? body.topK : 5,
    minScore: typeof body.minScore === "number" ? body.minScore : 0,
  }).catch((e) => {
    throw new ProvenanceKitError("EmbeddingFailed", "Text embedding failed", {
      details: e,
    });
  });

  return c.json(result);
});

export const searchRoute = r;
