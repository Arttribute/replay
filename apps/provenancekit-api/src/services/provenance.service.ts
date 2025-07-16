// apps/replay-api/src/services/provenance.service.ts
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

// --- helpers (same converters used in bundle service) ----------------
const toEntity = (r: typeof entity.$inferSelect): EAAEntity => ({
  id: r.entityId,
  role: r.role,
  name: r.name ?? undefined,
  wallet: r.wallet ?? undefined,
  publicKey: r.publicKey ?? undefined,
});

const toResource = (r: typeof resource.$inferSelect): EAAResource => ({
  address: { cid: r.cid, size: r.size, algorithm: r.algorithm as "sha256" },
  type: r.type,
  locations: r.locations,
  createdAt: "",
  createdBy: r.createdBy,
  rootAction: r.rootAction,
});

const toAction = (a: typeof action.$inferSelect): EAAAction => ({
  id: a.actionId,
  type: a.type,
  performedBy: a.performedBy,
  timestamp: a.timestamp.toISOString(),
  inputCids: a.inputCids ?? [],
  outputCids: a.outputCids ?? [],
  toolUsed: a.toolUsed ?? undefined,
  proof: a.proof ?? undefined,
});

const toAttr = (at: typeof attribution.$inferSelect): EAAAttribution => ({
  resourceCid: at.resourceCid,
  entityId: at.entityId,
  role: at.role,
  weight: at.weight ?? undefined,
  includedInRevenue: at.includedRev ?? undefined,
  includedInAttribution: at.includedAttr ?? undefined,
  note: at.note ?? undefined,
});

// ---------------------------------------------------------------------
// buildProvenance()
// ---------------------------------------------------------------------
/**
 * Recursively walks *upstream* from a CID until `depth` or no parents.
 * - collects every resource, action, entity and attribution encountered
 * - guarantees no infinite loops (tracks visited CIDs)
 */
export async function buildProvenance(
  rootCid: string,
  depth = 10
): Promise<ProvenanceBundle> {
  const todo: string[] = [rootCid];
  const seen = new Set<string>();

  const resRows: (typeof resource.$inferSelect)[] = [];
  const actRows: (typeof action.$inferSelect)[] = [];
  const entIds = new Set<string>();
  const attrRows: (typeof attribution.$inferSelect)[] = [];

  while (todo.length && depth-- > 0) {
    const cid = todo.shift()!;
    if (seen.has(cid)) continue;
    seen.add(cid);

    // resource --------------------------------------------------------
    const [res] = await db
      .select()
      .from(resource)
      .where(sql`cid = ${cid}`)
      .limit(1);
    if (!res) continue; // orphan CID
    resRows.push(res);
    entIds.add(res.createdBy);

    // producing actions ----------------------------------------------
    const acts = await db
      .select()
      .from(action)
      .where(sql`${action.outputCids} @> ${JSON.stringify([cid])}`);
    actRows.push(...acts);

    // upstream references (inputs + tool) ----------------------------
    for (const a of acts) {
      a.inputCids?.forEach((c) => !seen.has(c) && todo.push(c));
      if (a.toolUsed && !seen.has(a.toolUsed)) todo.push(a.toolUsed);
      entIds.add(a.performedBy);
    }

    // attributions for *this* cid ------------------------------------
    const attrs = await db
      .select()
      .from(attribution)
      .where(sql`resource_cid = ${cid}`);
    attrRows.push(...attrs);
    attrs.forEach((at) => entIds.add(at.entityId));
  }

  // entity rows -------------------------------------------------------
  const entRows = entIds.size
    ? await db
        .select()
        .from(entity)
        .where(sql`entity_id in (${[...entIds]})`)
    : [];

  // ------------------------------------------------------------------
  return {
    context: "https://replayprotocol.org/context/v1",
    entities: entRows.map(toEntity),
    resources: resRows.map(toResource),
    actions: actRows.map(toAction),
    attributions: attrRows.map(toAttr),
  };
}
