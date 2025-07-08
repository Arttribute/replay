import { db } from "../../db/client";
import { entity, resource, action, attribution } from "../../db/schema";
import { sql } from "drizzle-orm";
import {
  ProvenanceBundle,
  Entity as EAAEntity,
  Resource as EAAResource,
  Action as EAAAction,
  Attribution as EAAAttribution,
} from "@arttribute/eaa-types";
import { v4 as uuid } from "uuid";

/* ────────────────────────────────────────────────────────────
   Helpers to map DB → EAA types
   ──────────────────────────────────────────────────────────── */
function toEntity(row: typeof entity.$inferSelect): EAAEntity {
  return {
    id: row.entityId,
    role: row.role,
    name: row.name ?? undefined,
    wallet: row.wallet ?? undefined,
    publicKey: row.publicKey ?? undefined,
  };
}

function toResource(row: typeof resource.$inferSelect): EAAResource {
  return {
    address: {
      cid: row.cid,
      size: row.size,
      algorithm: row.algorithm as "sha256",
    },
    type: row.type,
    locations: row.locations,
    createdAt: "", // could store later
    createdBy: row.createdBy,
    rootAction: row.rootAction,
  };
}

function toAction(row: typeof action.$inferSelect): EAAAction {
  return {
    id: row.actionId,
    type: row.type,
    performedBy: row.performedBy,
    timestamp: row.timestamp.toISOString(),
    inputCids: row.inputCids ?? [],
    outputCids: row.outputCids ?? [],
    toolUsed: row.toolUsed ?? undefined,
    proof: row.proof ?? undefined,
  };
}

function toAttribution(row: typeof attribution.$inferSelect): EAAAttribution {
  return {
    resourceCid: row.resourceCid,
    entityId: row.entityId,
    role: row.role,
    weight: row.weight ?? undefined,
    includedInRevenue: row.includedRev ?? undefined,
    includedInAttribution: row.includedAttr ?? undefined,
    note: row.note ?? undefined,
  };
}

/* ────────────────────────────────────────────────────────────
   fetchBundle – GET /bundle/:cid
   ──────────────────────────────────────────────────────────── */
export async function fetchBundle(cid: string): Promise<ProvenanceBundle> {
  /* 1. core resource ------------------------------------------------ */
  const [resRow] = await db
    .select()
    .from(resource)
    .where(sql`cid=${cid}`)
    .limit(1);
  if (!resRow) throw new Error("resource not found");

  /* 2. the action that produced it --------------------------------- */
  const [actRow] = await db
    .select()
    .from(action)
    .where(sql`${action.outputCids} @> ${JSON.stringify([cid])}`)
    .limit(1);

  /* 3. entities referenced ----------------------------------------- */
  const entIds = new Set<string>([
    resRow.createdBy,
    ...(actRow ? [actRow.performedBy] : []),
  ]);
  const entRows = await db
    .select()
    .from(entity)
    .where(sql`entity_id in (${[...entIds]})`);

  /* 4. tool resource (if any) -------------------------------------- */
  let toolRows: (typeof resource.$inferSelect)[] = [];
  if (actRow?.toolUsed) {
    toolRows = await db
      .select()
      .from(resource)
      .where(sql`cid=${actRow.toolUsed}`);
  }

  /* 5. attributions ------------------------------------------------- */
  const attrRows = await db
    .select()
    .from(attribution)
    .where(sql`resource_cid=${cid}`);

  /* 6. compose bundle ---------------------------------------------- */
  return {
    context: "https://replayprotocol.org/context/v1",
    entities: entRows.map(toEntity),
    resources: [toResource(resRow), ...toolRows.map(toResource)],
    actions: actRow ? [toAction(actRow)] : [],
    attributions: attrRows.map(toAttribution),
  };
}

/* ────────────────────────────────────────────────────────────
   Optional: ingest an external bundle (kept from previous impl)
   ──────────────────────────────────────────────────────────── */
export async function ingestBundle(bundle: ProvenanceBundle) {
  await db.transaction(async (tx) => {
    if ((bundle.entities ?? []).length)
      await tx
        .insert(entity)
        .values(
          (bundle.entities ?? []).map((e) => ({
            entityId: e.id ?? "",
            role: e.role ?? "",
            name: e.name ?? null,
          }))
        )
        .onConflictDoNothing();

    if ((bundle.resources ?? []).length)
      await tx
        .insert(resource)
        .values(
          (bundle.resources ?? []).map((r) => ({
            cid: r.address?.cid ?? "",
            size: r.address?.size ?? 0,
            algorithm: r.address?.algorithm ?? "unknown",
            type: r.type ?? "unknown",
            locations: r.locations ?? [],
            createdBy: r.createdBy ?? "",
            rootAction: r.rootAction ?? "",
          }))
        )
        .onConflictDoNothing();

    if ((bundle.actions ?? []).length)
      await tx
        .insert(action)
        .values(
          (bundle.actions ?? []).map((a) => ({
            actionId: a.id || uuid(),
            type: a.type ?? "unknown",
            performedBy: a.performedBy ?? "unknown",
            timestamp: new Date(a.timestamp ?? "unknown"),
            inputCids: a.inputCids ?? [],
            outputCids: a.outputCids ?? [],
            tool: a.toolUsed ?? null,
            proof: a.proof ?? null,
          }))
        )
        .onConflictDoNothing();

    if (bundle.attributions ?? [])
      await tx
        .insert(attribution)
        .values(
          (bundle.attributions ?? []).map((at) => ({
            id: uuid(),
            resourceCid: at.resourceCid ?? "",
            entityId: at.entityId ?? "",
            role: at.role ?? "",
            weight: at.weight ?? null,
            includedRev: at.includedInRevenue ?? false,
            includedAttr: at.includedInAttribution ?? false,
          }))
        )
        .onConflictDoNothing();
  });
}
