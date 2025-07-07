import { db } from "../../db/client";
import { entity, action, resource, attribution } from "../../db/schema";
import { sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { pinBytes } from "../ipfs/pinata";
import { EmbeddingService } from "../embedding/service";

import { z } from "zod";
import {
  Entity as EAAEntity,
  Action as EAAAction,
} from "@arttribute/eaa-types";

/**
 * Minimal subset we need from the full EAA spec
 * - `role` is mandatory for a new entity; everything else optional.
 * - Action accepts `inputCids` (array of resource CIDs).
 */
export const ActivityPayload = z.object({
  entity: EAAEntity.pick({
    id: true,
    role: true,
    name: true,
    wallet: true,
    publicKey: true,
    metadata: true,
    extensions: true,
  }), // role REQUIRED, others optional

  action: EAAAction.pick({
    type: true,
    proof: true,
    extensions: true,
  }).extend({
    inputCids: z.array(z.string()).optional(),
  }),
});

export type ActivityPayload = z.infer<typeof ActivityPayload>;

const embedder = new EmbeddingService();

/*─────────────────────────────────────────────────────────*/
export async function createActivity(opts: {
  fileBytes: Uint8Array;
  filename: string;
  mime: string;
  entity: ActivityPayload["entity"];
  action: ActivityPayload["action"];
}) {
  return db.transaction(async (tx) => {
    /* 1️⃣  upsert entity */
    const entId = opts.entity.id ?? uuid();
    await tx
      .insert(entity)
      .values({
        entityId: entId,
        role: opts.entity.role,
        name: opts.entity.name ?? null,
        wallet: opts.entity.wallet ?? null,
        publicKey: opts.entity.publicKey ?? null,
        metadata: opts.entity.metadata ?? null,
        extensions: opts.entity.extensions ?? null,
      })
      .onConflictDoNothing();

    /* 2️⃣  pin file to IPFS */
    const { cid, size } = await pinBytes(opts.fileBytes, opts.filename);

    /* 3️⃣  insert action */
    const [act] = await tx
      .insert(action)
      .values({
        type: opts.action.type,
        performedBy: entId,
        timestamp: new Date(),
        inputCids: opts.action.inputCids ?? [],
        outputCids: [cid],
        proof: opts.action.proof ?? null,
        extensions: opts.action.extensions ?? null,
      })
      .returning({ actionId: action.actionId });

    /* 4️⃣  embedding */
    const dataUri = `data:${opts.mime};base64,${Buffer.from(
      opts.fileBytes
    ).toString("base64")}`;
    const vec = await embedder.vector("image", dataUri); // swap by type if needed

    /* 5️⃣  resource row */
    await tx.insert(resource).values({
      cid,
      size,
      algorithm: "sha256",
      type: "image",
      locations: [{ uri: `ipfs://${cid}`, provider: "ipfs", verified: true }],
      createdBy: entId,
      rootAction: act.actionId,
      license: null,
      embedding: vec,
      extensions: null,
    });

    /* 6️⃣  creator attribution 100 % */
    await tx.insert(attribution).values({
      resourceCid: cid,
      entityId: entId,
      role: "creator",
      weight: 10000,
      includedRev: true,
      includedAttr: true,
      note: null,
      extensions: null,
    });

    /* 7️⃣  source-material attributions (optional) */
    if (opts.action.inputCids?.length) {
      await tx.insert(attribution).values(
        opts.action.inputCids.map((src) => ({
          resourceCid: cid,
          entityId: entId, // swap for real owner if known
          role: "sourceMaterial",
          weight: null,
          includedRev: false,
          includedAttr: true,
          note: null,
          extensions: null,
        }))
      );
    }

    return { cid, actionId: act.actionId, entityId: entId };
  });
}
