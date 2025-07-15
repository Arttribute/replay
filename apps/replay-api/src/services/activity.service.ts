/*─────────────────────────────────────────────────────────────*\
  src/services/activity.service.ts
\*─────────────────────────────────────────────────────────────*/

import { z } from "zod";
import { db } from "../../db/client.js";
import { entity, action, resource, attribution } from "../../db/schema.js";
import { pinBytes } from "../ipfs/pinata.js";
import { EmbeddingService } from "../embedding/service.js";
import { toDataURI } from "../utils.js";
import { v4 as uuidv4 } from "uuid";

const embedder = new EmbeddingService();

/*─────────────────────────────────────────────────────────────*\
  1.  Multipart JSON payload validation
\*─────────────────────────────────────────────────────────────*/
export const ActivityPayload = z.object({
  entity: z.object({
    id: z.string().optional(),
    role: z.string(),
    name: z.string().optional(),
    wallet: z.string().optional(),
    publicKey: z.string().optional(),
  }),
  action: z.object({
    type: z.string(),
    inputCids: z.array(z.string()).default([]),
    toolCid: z.string().optional(),
    proof: z.string().optional(),
    extensions: z.record(z.any()).optional(),
  }),
  resourceType: z.string().optional(),
});
export type ActivityPayload = z.infer<typeof ActivityPayload>;

/*─────────────────────────────────────────────────────────────*\
  2.  Public façade
\*─────────────────────────────────────────────────────────────*/
export async function createActivity(file: File, body: unknown) {
  /* 2-A. Validate */
  const parsed = ActivityPayload.safeParse(body);
  if (!parsed.success) {
    throw new Error(JSON.stringify(parsed.error.format()));
  }
  const { entity: ent, action: act, resourceType: rtype } = parsed.data;

  /* 2-B. File → bytes + MIME */
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";

  /* 2-C. PG transactional work */
  return db.transaction(async (tx) => {
    /* 1️⃣  Entity upsert -------------------------------------------------- */
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
      .onConflictDoNothing();

    /* 2️⃣  Pin & embed ---------------------------------------------------- */
    const { cid, size } = await pinBytes(bytes, file.name, mime);
    const fileType = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("audio/")
      ? "audio"
      : mime.startsWith("video/")
      ? "video"
      : "text";
    console.log("Embedding file type:", fileType);
    const vec = await embedder.vector(fileType, toDataURI(bytes, mime));

    /* 3️⃣  Action row ----------------------------------------------------- */
    const [a] = await tx
      .insert(action)
      .values({
        type: act.type,
        performedBy: entityId,
        timestamp: new Date(),
        inputCids: act.inputCids,
        outputCids: [cid],
        toolUsed: act.toolCid ?? null,
        proof: act.proof ?? null,
        extensions: act.extensions ?? null,
      })
      .returning({ actionId: action.actionId });
    const actionId = a.actionId;

    /* 4️⃣  Resource row --------------------------------------------------- */
    await tx.insert(resource).values({
      cid,
      size,
      algorithm: "sha256",
      type: rtype || fileType,
      locations: [{ uri: `ipfs://${cid}`, provider: "ipfs", verified: true }],
      createdBy: entityId,
      rootAction: actionId,
      embedding: vec,
    });

    /* 5️⃣  Attributions (only for *external* inputs) ---------------------- */
    const attrRows: (typeof attribution.$inferInsert)[] = [];

    /* inputCids -> role=sourceMaterial */
    for (const srcCid of act.inputCids) {
      attrRows.push({
        resourceCid: cid,
        entityId: entityId, // 🔸 if real owner is known, replace here
        role: "sourceMaterial",
        includedAttr: true,
      });
    }

    /* toolCid    -> role=tool */
    if (act.toolCid) {
      attrRows.push({
        resourceCid: cid,
        entityId: entityId, // 🔸 swap if tool owner known
        role: "tool",
        includedAttr: false,
      });
    }

    if (attrRows.length) {
      await tx.insert(attribution).values(attrRows);
    }

    /* 6️⃣  Done ----------------------------------------------------------- */
    return { cid, actionId, entityId };
  });
}
