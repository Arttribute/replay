//src/services/activity.service.ts
import { z } from "zod";
import { db } from "../../db/client.js";
import { entity, action, resource, attribution } from "../../db/schema.js";
import { pinBytes } from "../ipfs/pinata.js";
import { EmbeddingService } from "../embedding/service.js";
import { toDataURI, inferKindFromMime } from "../utils.js";
import { v4 as uuidv4 } from "uuid";
import { sql } from "drizzle-orm";
import { ProvenanceKitError } from "../errors.js";

/* ----------------------------- Embeddings ---------------------------- */
const embedder = new EmbeddingService();

/* ----------------------------- Zod schema ---------------------------- */
export const ActivityPayload = z.object({
  /* Who is performing this action */
  entity: z.object({
    id: z.string().optional(),
    role: z.string(), // human | ai | organization | ext:...
    name: z.string().optional(),
    wallet: z.string().optional(),
    publicKey: z.string().optional(),
  }),

  /* What action is being performed */
  action: z.object({
    type: z.string(), // ext:... or any string
    inputCids: z.array(z.string()).default([]),
    toolCid: z.string().optional(),
    proof: z.string().optional(),
    extensions: z.record(z.any()).optional(), // arbitrary extra data
  }),

  /* What kind of resource (optional override, otherwise inferred from mime) */
  resourceType: z.string().optional(),

  /* Link this write to a session (optional) */
  sessionId: z.string().uuid().optional(),
});
export type ActivityPayload = z.infer<typeof ActivityPayload>;

/* -------------------------------------------------------------------- */
/*  createActivity()                                                    */
/*  - Receives a single uploaded file + JSON describing the action      */
/*  - Pins, embeds, dedup-checks, writes DB rows (entity/action/resource)
/* -------------------------------------------------------------------- */
export async function createActivity(file: File, body: unknown) {
  /* 1. Validate payload shape */
  const parsed = ActivityPayload.safeParse(body);
  if (!parsed.success) throw ProvenanceKitError.fromZod(parsed.error);

  const {
    entity: ent,
    action: act,
    resourceType: rtype,
    sessionId,
  } = parsed.data;

  /* 2. Ensure the performer role exists */
  if (!ent.role || !ent.role.trim())
    throw new ProvenanceKitError("MissingField", "`entity.role` is required", {
      recovery:
        "Provide the role performing this action (human/ai/organization)",
    });

  /* 3. File → bytes + MIME */
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";

  /* 4. Pin to IPFS  */
  const { cid, size } = await pinBytes(bytes, file.name || "file.bin", mime);

  /* 5. Exact duplicate check (CID collision) */
  const [existing] = await db
    .select({ cid: resource.cid })
    .from(resource)
    .where(sql`cid = ${cid}`)
    .limit(1);

  if (existing)
    throw new ProvenanceKitError(
      "Duplicate",
      "Resource with identical CID already exists",
      {
        recovery: "Reuse the returned CID instead of uploading again",
        details: { cid, similarity: 1 },
      }
    );

  /* 6. Embedding + near-duplicate detection */
  const kind = rtype ?? inferKindFromMime(mime) ?? "text";
  const vec = await embedder.vector(kind as any, toDataURI(bytes, mime));

  const near = await embedder.matchFiltered(vec, {
    topK: 1,
    minScore: 0.95,
    type: kind,
  });

  if (near.length)
    throw new ProvenanceKitError(
      "Duplicate",
      "A very similar resource already exists",
      {
        recovery:
          "Consider linking to the existing CID instead of re‑uploading",
        details: { cid: near[0].cid, similarity: near[0].score },
      }
    );

  /* 7. Transactional DB write */
  return db.transaction(async (tx) => {
    /* 7‑A. Upsert entity */
    const entityId = ent.id ?? uuidv4();
    await tx
      .insert(entity)
      .values({
        entityId,
        role: ent.role,
        name: ent.name ?? null,
        wallet: ent.wallet ?? null,
        publicKey: ent.publicKey ?? null,
      })
      .onConflictDoNothing(); // ignore if exists

    /* 7‑B. Insert action row */
    const [a] = await tx
      .insert(action)
      .values({
        type: act.type,
        performedBy: entityId,
        timestamp: new Date(),
        inputCids: act.inputCids ?? [],
        outputCids: [cid],
        toolUsed: act.toolCid ?? null,
        proof: act.proof ?? null,
        extensions: act.extensions ?? null,
        sessionId: sessionId ?? null,
      })
      .returning({ actionId: action.actionId });
    console.log("Action created:", a.actionId);

    /* 7‑C. Insert resource row */
    await tx.insert(resource).values({
      cid,
      size,
      algorithm: "sha256",
      type: kind,
      locations: [{ uri: `ipfs://${cid}`, provider: "ipfs", verified: true }],
      createdBy: entityId,
      rootAction: a.actionId,
      embedding: vec,
      sessionId: sessionId ?? null,
    });
    console.log("Resource created:", cid);

    /* 7‑D. Attributions (optional source inputs & tool) */
    const rows: (typeof attribution.$inferInsert)[] = [];

    for (const src of act.inputCids ?? []) {
      rows.push({
        resourceCid: cid,
        entityId,
        role: "sourceMaterial",
        includedAttr: true,
      });
    }

    if (act.toolCid) {
      rows.push({
        resourceCid: cid,
        entityId,
        role: "tool",
        includedAttr: false,
      });
    }

    if (rows.length) await tx.insert(attribution).values(rows);
    console.log("Attributions created:", rows.length);

    return { cid, actionId: a.actionId, entityId };
  });
}
