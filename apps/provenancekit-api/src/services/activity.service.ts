//src/services/activity.service.ts

import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../../db/client.js";
import { action, attribution, entity, resource } from "../../db/schema.js";
import { EmbeddingService } from "../embedding/service.js";
import { ProvenanceKitError } from "../errors.js";
import { pinBytes } from "../ipfs/pinata.js";
import { toDataURI } from "../utils.js";

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
	/* 2‑A. payload validation */
	const parsed = ActivityPayload.safeParse(body);
	if (!parsed.success) throw ProvenanceKitError.fromZod(parsed.error);

	const { entity: ent, action: act, resourceType: rtype } = parsed.data;

	/* 2‑B. File → bytes + MIME */
	const bytes = new Uint8Array(await file.arrayBuffer());
	const mime = file.type || "application/octet-stream";

	/* 2‑C. Pin to IPFS (returns deterministic CID) */
	const { cid, size } = await pinBytes(bytes, file.name, mime);

	/* 2‑D. Prevent exact duplicates -------------------------------- */
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
				recovery: "Reuse the returned CID instead of uploading",
				details: { cid, similarity: 1 },
			},
		);

	/* 2‑E. Compute embedding & high‑similarity check --------------- */
	const fileType = mime.startsWith("image/")
		? "image"
		: mime.startsWith("audio/")
			? "audio"
			: mime.startsWith("video/")
				? "video"
				: "text";

	const vec = await embedder.vector(fileType, toDataURI(bytes, mime));

	const near = await embedder.matchFiltered(vec, {
		topK: 1,
		minScore: 0.95,
		type: fileType,
	});

	if (near.length)
		throw new ProvenanceKitError(
			"Duplicate",
			"A very similar resource already exists",
			{
				recovery:
					"Consider linking to the existing CID instead of re‑uploading",
				details: { cid: near[0].cid, similarity: near[0].score },
			},
		);

	/* 2‑F. Transactional write ------------------------------------ */
	return db.transaction(async (tx) => {
		/* 1️⃣ Entity upsert */
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

		/* 2️⃣ Action row */
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

		/* 3️⃣ Resource row */
		await tx.insert(resource).values({
			cid,
			size,
			algorithm: "sha256",
			type: rtype || fileType,
			locations: [{ uri: `ipfs://${cid}`, provider: "ipfs", verified: true }],
			createdBy: entityId,
			rootAction: a.actionId,
			embedding: vec,
		});

		/* 4️⃣ Attributions (for external inputs or tool) */
		const rows: (typeof attribution.$inferInsert)[] = [];

		for (const src of act.inputCids)
			rows.push({
				resourceCid: cid,
				entityId,
				role: "sourceMaterial",
				includedAttr: true,
			});

		if (act.toolCid)
			rows.push({
				resourceCid: cid,
				entityId,
				role: "tool",
				includedAttr: false,
			});

		if (rows.length) await tx.insert(attribution).values(rows);

		return { cid, actionId: a.actionId, entityId };
	});
}
