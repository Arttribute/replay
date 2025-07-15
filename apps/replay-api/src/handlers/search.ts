import { Hono } from "hono";
import { searchByFile, searchByText } from "../services/search.service";
import { inferKindFromMime } from "../utils";

export const searchRoute = new Hono();

/*────────────────────────────────────────────────────────────*
 *  POST /search/file                                         *
 *  Multipart form: “file” field required                     *
 *  Optional query params: ?type=audio|image…&topK=10&min=0.7 *
 *────────────────────────────────────────────────────────────*/
searchRoute.post("/search/file", async (c) => {
  const topK = Number(c.req.query("topK") ?? 5);
  const minScore = Number(c.req.query("min") ?? 0);
  const override = c.req.query("type"); // optional resource-type

  const form = await c.req.parseBody();
  if (!(form.file instanceof File))
    return c.json({ error: "`file` field (multipart) required" }, 400);

  const kind = override || inferKindFromMime(form.file.type) || undefined;

  try {
    const results = await searchByFile(form.file, {
      type: kind,
      topK,
      minScore,
    });
    return c.json(results, 200);
  } catch (err: any) {
    return c.json({ error: err.message ?? String(err) }, 400);
  }
});

/*────────────────────────────────────────────────────────────*
 *  POST /search/text                                         *
 *  JSON body: { text: "...", type?: "image", topK?: 10,      *
 *               minScore?: 0.75 }                            *
 *────────────────────────────────────────────────────────────*/
searchRoute.post("/search/text", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (typeof body.text !== "string" || body.text.trim() === "")
    return c.json({ error: "`text` (string) required" }, 400);

  const topK = typeof body.topK === "number" ? body.topK : 5;
  const minScore = typeof body.minScore === "number" ? body.minScore : 0;
  const kind = typeof body.type === "string" ? body.type : undefined;

  try {
    const results = await searchByText(body.text, {
      type: kind,
      topK,
      minScore,
    });
    return c.json(results, 200);
  } catch (err: any) {
    return c.json({ error: err.message ?? String(err) }, 400);
  }
});
