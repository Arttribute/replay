// src/services/bundle.service.ts

import type {
	Action as EAAAction,
	Attribution as EAAAttribution,
	Entity as EAAEntity,
	Resource as EAAResource,
	ProvenanceBundle,
} from "@arttribute/eaa-types";
import { sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "../../db/client.js";
import { action, attribution, entity, resource } from "../../db/schema.js";

/*------------------------------------------------------------*\
  Helpers to map EAA Type → DB row shapes
\*------------------------------------------------------------*/
function entRow(e: EAAEntity) {
	return {
		entityId: e.id ?? uuid(),
		role: typeof e.role === "string" ? e.role : String(e.role ?? "unknown"),
		name: e.name ?? null,
		wallet: e.wallet ?? null,
		metadata: e.metadata ?? null,
		extensions: e.extensions ?? null,
	};
}

function resRow(r: EAAResource) {
	return {
		cid: r.address?.cid ?? "",
		size: r.address?.size ?? 0,
		algorithm: r.address?.algorithm ?? "",
		type: typeof r.type === "string" ? r.type : String(r.type ?? "unknown"),
		locations: r.locations ?? [],
		createdBy: r.createdBy ?? "",
		rootAction: r.rootAction ?? "",
		license: r.license ?? "",
		extensions: r.extensions ?? null,
	};
}

function actRow(a: EAAAction) {
	return {
		actionId: a.id ?? "",
		type: typeof a.type === "string" ? a.type : String(a.type ?? "unknown"),
		performedBy: a.performedBy ?? "",
		timestamp: a.timestamp ? new Date(a.timestamp) : new Date(0),
		inputCids: a.inputCids ?? [],
		outputCids: a.outputCids ?? [],
		proof: a.proof ?? "",
		extensions: a.extensions ?? {},
	};
}

function attrRow(at: EAAAttribution) {
	return {
		id: uuid(),
		resourceCid: at.resourceCid ?? "",
		entityId: at.entityId ?? "",
		role: typeof at.role === "string" ? at.role : String(at.role),
		weight: at.weight ?? null,
		includedRev: at.includedInRevenue ? true : false,
		includedAttr: at.includedInAttribution ? true : false,
		note: at.note ?? null,
		extensions: at.extensions ?? null,
	};
}

/*------------------------------------------------------------*\
  Main ingest function
\*------------------------------------------------------------*/
export async function ingestBundle(bundle: ProvenanceBundle) {
	const { entities, resources, actions, attributions } = bundle;

	await db.transaction(async (tx) => {
		/* entities ------------------------------------------------*/
		if ((entities ?? []).length) {
			await tx
				.insert(entity)
				.values((entities ?? []).map(entRow))
				.onConflictDoNothing(); // ignore duplicates
		}

		/* resources ----------------------------------------------*/
		if ((resources ?? []).length) {
			await tx
				.insert(resource)
				.values(resources!.map(resRow))
				.onConflictDoNothing(); // duplicate CIDs ignored
		}

		/* actions -------------------------------------------------*/
		if ((actions ?? []).length) {
			await tx
				.insert(action)
				.values((actions ?? []).map(actRow))
				.onConflictDoNothing(); // duplicate IDs ignored
		}

		/* attributions -------------------------------------------*/
		if ((attributions ?? []).length) {
			await tx
				.insert(attribution)
				.values((attributions ?? []).map(attrRow))
				.onConflictDoNothing(); // duplicate composite keys
		}
	});
}

/*------------------------------------------------------------*\
  Convenience: fetch a whole bundle back out (optional)
\*------------------------------------------------------------*/
export async function fetchBundle(cid: string): Promise<ProvenanceBundle> {
	const [res] = await db
		.select()
		.from(resource)
		.where(sql`cid = ${cid}`)
		.limit(1);
	if (!res) throw new Error("resource not found");

	const acts = await db
		.select()
		.from(action)
		.where((a) => sql`${cid} = any(${a.outputCids})`);

	const entityIds = new Set<string>(
		acts.map((a) => a.performedBy).concat(res.createdBy),
	);
	const ents = await db
		.select()
		.from(entity)
		.where((e) => sql`${[...entityIds]} @> array[e.entity_id]`);
	const attrs = await db
		.select()
		.from(attribution)
		.where((at) => sql`resource_cid = ${cid}`);

	return {
		context: "https://replayprotocol.org/context/v1",
		entities: ents,
		resources: [res],
		actions: acts,
		attributions: attrs,
	} as unknown as ProvenanceBundle;
}
