// lib/attachments.ts
import type { ProvenanceGraph } from "@provenancekit/sdk";

export type AttachmentStatus = "pending" | "match" | "new";

export type InspectedAttachment = {
  tempId: string;
  file: File;
  status: AttachmentStatus;
  cid: string | null;
  score: number | null;
  type: string;
  mime: string;
  size: number;
  graph: ProvenanceGraph | null;
};
