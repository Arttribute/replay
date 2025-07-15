import { pinBytes } from "../ipfs/pinata.js";
import { EmbeddingService } from "../embedding/service.js";
import { db } from "../../db/client.js";
import { resource } from "../../db/schema.js";
import { toDataURI } from "../utils.js";

const embedder = new EmbeddingService();

export async function insertResource(opts: {
  bytes: Uint8Array;
  mime: string;
  filename: string;
  creator: string;
  actionId: string;
  kind: "image" | "text" | "audio" | "video";
}) {
  const { cid, size } = await pinBytes(opts.bytes, opts.filename, opts.mime);
  const vec = await embedder.vector(
    opts.kind,
    toDataURI(opts.bytes, opts.mime)
  );

  await db.insert(resource).values({
    cid,
    size,
    algorithm: "sha256",
    type: opts.kind,
    locations: [{ uri: `ipfs://${cid}`, provider: "ipfs", verified: true }],
    createdBy: opts.creator,
    rootAction: opts.actionId,
    embedding: vec,
  });

  return cid;
}
