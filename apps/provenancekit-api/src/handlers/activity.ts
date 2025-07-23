import { Hono } from "hono";
import {
  createActivity,
  ActivityPayload,
} from "../services/activity.service.js";
import { ProvenanceKitError } from "../errors.js";
import { ZodError } from "zod";

const r = new Hono();

/**
 * POST /activity
 * Multipart form:
 *   file=<binary>
 *   json=<activity-payload-json-string>
 *
 * Body schema = ActivityPayload (see service)
 */
r.post("/activity", async (c) => {
  const form = await c.req.parseBody();

  if (!(form.file instanceof File))
    throw new ProvenanceKitError("MissingField", "`file` part is required", {
      recovery: "Attach the binary file in the multipart form",
    });

  if (typeof form.json !== "string")
    throw new ProvenanceKitError("MissingField", "`json` part is required", {
      recovery: "Attach a JSON string describing entity & action",
    });

  let payload: unknown;
  try {
    payload = JSON.parse(form.json);
  } catch {
    throw new ProvenanceKitError("InvalidField", "`json` is not valid JSON", {
      recovery: "Ensure `json` multipart field is valid JSON",
    });
  }

  /* Validate early to return nice 422 errors */
  const parsed = ActivityPayload.safeParse(payload);
  if (!parsed.success) throw ProvenanceKitError.fromZod(parsed.error);

  try {
    const result = await createActivity(form.file, payload);
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof ProvenanceKitError) throw err;
    if (err instanceof ZodError) throw ProvenanceKitError.fromZod(err);
    throw err;
  }
});

export default r;
