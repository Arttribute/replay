import { db } from "../../db/client.js";
import { entity, resource, action } from "../../db/schema.js";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  public graph types                                                 */
/* ------------------------------------------------------------------ */
export type NodeType = "resource" | "action" | "entity";

export interface GraphNode {
  id: string; // "res:CID", "act:UUID", "ent:DID"
  type: NodeType;
  label: string;
  data: Record<string, any>; // resource / action / entity row (sans embedding)
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "produces" | "consumes" | "tool" | "performedBy";
}

export interface ProvenanceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/* ------------------------------------------------------------------ */
/*  helper: strip embedding column from a resource row                 */
/* ------------------------------------------------------------------ */
function stripEmbedding(row: typeof resource.$inferSelect) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding, ...rest } = row;
  return rest;
}

/* ------------------------------------------------------------------ */
/*  buildProvenanceGraph                                               */
/* ------------------------------------------------------------------ */
export async function buildProvenanceGraph(
  rootCid: string,
  maxDepth = 10
): Promise<ProvenanceGraph> {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const queue: { cid: string; depth: number }[] = [{ cid: rootCid, depth: 0 }];
  const seen = new Set<string>();

  while (queue.length) {
    const { cid, depth } = queue.shift()!;
    if (seen.has(cid) || depth > maxDepth) continue;
    seen.add(cid);

    /* ── Resource node ──────────────────────────────────────────── */
    const [res] = await db
      .select()
      .from(resource)
      .where(sql`cid = ${cid}`)
      .limit(1);
    if (!res) continue;

    const resNodeId = `res:${res.cid}`;
    nodeMap.set(resNodeId, {
      id: resNodeId,
      type: "resource",
      label: res.cid.slice(0, 8) + "…",
      data: stripEmbedding(res),
    });

    /* ── Actions that produced it ──────────────────────────────── */
    const acts = await db
      .select()
      .from(action)
      .where(sql`${action.outputCids} @> ${JSON.stringify([cid])}`);

    for (const a of acts) {
      const actNodeId = `act:${a.actionId}`;
      if (!nodeMap.has(actNodeId)) {
        nodeMap.set(actNodeId, {
          id: actNodeId,
          type: "action",
          label: a.type,
          data: a,
        });
      }

      // action → produced resource
      edges.push({ from: actNodeId, to: resNodeId, type: "produces" });

      /* performer entity ----------------------------------------- */
      const entNodeId = `ent:${a.performedBy}`;
      if (!nodeMap.has(entNodeId)) {
        const [ent] = await db
          .select()
          .from(entity)
          .where(sql`entity_id = ${a.performedBy}`)
          .limit(1);
        nodeMap.set(entNodeId, {
          id: entNodeId,
          type: "entity",
          label: ent?.name ?? a.performedBy.slice(0, 6) + "…",
          data: ent ?? { entityId: a.performedBy },
        });
      }
      edges.push({ from: entNodeId, to: actNodeId, type: "performedBy" });

      /* input resources ------------------------------------------ */
      for (const input of a.inputCids ?? []) {
        edges.push({ from: `res:${input}`, to: actNodeId, type: "consumes" });
        queue.push({ cid: input, depth: depth + 1 });
      }

      /* tool resource (optional) --------------------------------- */
      if (a.toolUsed) {
        edges.push({ from: `res:${a.toolUsed}`, to: actNodeId, type: "tool" });
        queue.push({ cid: a.toolUsed, depth: depth + 1 });
      }
    }
  }

  return { nodes: [...nodeMap.values()], edges };
}
