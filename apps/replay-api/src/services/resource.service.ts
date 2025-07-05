import { pinBytes } from "../ipfs/pinata";
import { EmbeddingService } from "../embedding/service";
import { db } from "../../db/client";
import { resource } from "../../db/schema";

const embedder = new EmbeddingService();

/** Helper: bytes → data URI */
function toDataURI(bytes: Uint8Array, mime = "application/octet-stream") {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function createResource(opts: {
  data: Uint8Array; // raw bytes from upload
  filename: string;
  mime: string; // e.g. "image/png"
  type: "text" | "image" | "audio" | "video";
  createdBy: string;
  rootAction: string;
}) {
  /* 1️⃣  Pin to IPFS */
  const { cid, size } = await pinBytes(opts.data, opts.filename);

  /* 2️⃣  Build a base-64 data URI */
  const dataUri = toDataURI(opts.data, opts.mime);

  /* 3️⃣  Vector */
  const vec = await embedder.vector(opts.type, dataUri);

  /* 4️⃣  Insert with embedding */
  await db.insert(resource).values({
    cid,
    size,
    algorithm: "sha256",
    type: opts.type,
    locations: [{ uri: `ipfs://${cid}`, provider: "ipfs", verified: true }],
    createdBy: opts.createdBy,
    rootAction: opts.rootAction,
    embedding: vec,
  });

  return { cid, size };
}
