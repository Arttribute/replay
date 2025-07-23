/* Re‑export the canonical bundle / entity / resource types */
export * from "@arttribute/eaa-types";

/*───────────────────────────────────────────────────────────*\
 | 1.  Duplicate‑handling helper                              |
\*───────────────────────────────────────────────────────────*/
export interface DuplicateDetails {
  cid: string;
  similarity: number; // 1  for exact, 0.95…0.99 for near‑dup
}

/*───────────────────────────────────────────────────────────*\
 | 2.  Search match                                           |
\*───────────────────────────────────────────────────────────*/
export interface Match {
  cid: string;
  type: string;
  score: number; // cosine similarity 0‑1
}

export interface UploadMatchResult {
  verdict: "auto" | "review" | "no-match";
  matches: Match[];
}

/*───────────────────────────────────────────────────────────*\
 | 3.  Provenance Graph (same shape as API)                   |
\*───────────────────────────────────────────────────────────*/
export type NodeType = "resource" | "action" | "entity";

export interface GraphNode {
  id: string; // "res:{CID}", "act:{UUID}", "ent:{ID}"
  type: NodeType;
  label: string; // short display label
  data: Record<string, any>; // the raw DB row sans embedding
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

export interface Session {
  sessionId: string;
  title?: string | null;
  metadata?: any;
  startedAt: string;
  endedAt?: string | null;
}

export interface SessionMessage {
  messageId: string;
  sessionId: string;
  entityId?: string | null;
  content: any;
  createdAt: string;
}

export interface SessionBundle {
  session: Session;
  messages: SessionMessage[];
  actions: any[];
  resources: any[];
}
