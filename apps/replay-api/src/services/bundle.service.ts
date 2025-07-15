/*─────────────────────────────────────────────────────────────*\
  src/services/bundle.service.ts
\*─────────────────────────────────────────────────────────────*/

import { db } from "../../db/client.js";
import { entity, resource, action, attribution } from "../../db/schema.js";
import { sql } from "drizzle-orm";
import {
  ProvenanceBundle,
  Entity as EAAEntity,
  Resource as EAAResource,
  Action as EAAAction,
  Attribution as EAAAttribution,
} from "@arttribute/eaa-types";
import { v4 as uuidv4 } from "uuid";

/*---------- helpers: DB → EAA ---------------------------------------*/
const toEntity = (row: typeof entity.$inferSelect): EAAEntity => ({
  id: row.entityId,
  role: row.role,
  name: row.name ?? undefined,
  wallet: row.wallet ?? undefined,
  publicKey: row.publicKey ?? undefined,
});

const toResource = (row: typeof resource.$inferSelect): EAAResource => ({
  address: {
    cid: row.cid,
    size: row.size,
    algorithm: row.algorithm as "sha256",
  },
  type: row.type,
  locations: row.locations,
  createdAt: "", // not stored yet
  createdBy: row.createdBy,
  rootAction: row.rootAction,
});

const toAction = (row: typeof action.$inferSelect): EAAAction => ({
  id: row.actionId,
  type: row.type,
  performedBy: row.performedBy,
  timestamp: row.timestamp.toISOString(),
  inputCids: row.inputCids ?? [],
  outputCids: row.outputCids ?? [],
  toolUsed: row.toolUsed ?? undefined,
  proof: row.proof ?? undefined,
});

const toAttribution = (
  row: typeof attribution.$inferSelect
): EAAAttribution => ({
  resourceCid: row.resourceCid,
  entityId: row.entityId,
  role: row.role,
  weight: row.weight ?? undefined,
  includedInRevenue: row.includedRev ?? undefined,
  includedInAttribution: row.includedAttr ?? undefined,
  note: row.note ?? undefined,
});

/*─────────────────────────────────────────────────────────────*\
  fetchBundle – GET /bundle/:cid
\*─────────────────────────────────────────────────────────────*/
export async function fetchBundle(cid: string): Promise<ProvenanceBundle> {
  /* 1️⃣  target resource -------------------------------------------*/
  const [coreRes] = await db
    .select()
    .from(resource)
    .where(sql`cid = ${cid}`)
    .limit(1);
  if (!coreRes) throw new Error("resource not found");

  /* 2️⃣  producing action ------------------------------------------*/
  const [act] = await db
    .select()
    .from(action)
    .where(sql`${action.outputCids} @> ${JSON.stringify([cid])}`)
    .limit(1);

  /* 3️⃣  gather every CID we need expanded -------------------------*/
  const extraCids = new Set<string>();
  if (act) {
    (act.inputCids ?? []).forEach((c) => extraCids.add(c));
    if (act.toolUsed) extraCids.add(act.toolUsed);
  }
  extraCids.delete(cid); // core already fetched

  /* 4️⃣  pull those resource rows ----------------------------------*/
  let extraResRows: (typeof resource.$inferSelect)[] = [];
  if (extraCids.size) {
    extraResRows = await db
      .select()
      .from(resource)
      .where(sql`cid in (${[...extraCids]})`);
  }

  /* 5️⃣  union => complete resource list ---------------------------*/
  const allResRows = [coreRes, ...extraResRows];

  /* 6️⃣  entity IDs to include -------------------------------------*/
  const entIds = new Set<string>([coreRes.createdBy]);
  if (act) {
    entIds.add(act.performedBy);
    allResRows.forEach((r) => entIds.add(r.createdBy));
  }

  const entRows = await db
    .select()
    .from(entity)
    .where(sql`entity_id in (${[...entIds]})`);

  /* 7️⃣  attributions (only for the core resource) -----------------*/
  const attrRows = await db
    .select()
    .from(attribution)
    .where(sql`resource_cid = ${cid}`);

  /* 8️⃣  compose bundle --------------------------------------------*/
  return {
    context: "https://replayprotocol.org/context/v1",
    entities: entRows.map(toEntity),
    resources: allResRows.map(toResource),
    actions: act ? [toAction(act)] : [],
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
            actionId: a.id || uuidv4(),
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
            id: uuidv4(),
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
