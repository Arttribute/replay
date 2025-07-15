import { toDataURI, inferKindFromMime } from "../utils";
import { EmbeddingService } from "../embedding/service";

const embedder = new EmbeddingService();

/* ------------------------------------------------------------------ */
/* 1️⃣  Search by *uploaded file*                                      */
/* ------------------------------------------------------------------ */
export async function searchByFile(
  file: File,
  opts: { type?: string; topK?: number; minScore?: number } = {}
) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";

  const kind = (opts.type as any) ?? inferKindFromMime(mime);
  if (!kind) throw new Error(`Cannot infer resource kind from mime ${mime}`);

  const vec = await embedder.vector(kind, toDataURI(bytes, mime));
  if (!vec) throw new Error(`Failed to generate vector for ${kind}`);
  return embedder.matchFiltered(vec, { ...opts, type: kind });
}

/* ------------------------------------------------------------------ */
/* 2️⃣  Search by free-text prompt                                     */
/* ------------------------------------------------------------------ */
export async function searchByText(
  text: string,
  opts: { type?: string; topK?: number; minScore?: number } = {}
) {
  const vec = await embedder.vector("text", text);
  if (!vec) throw new Error("Failed to generate vector for text");
  return embedder.matchFiltered(vec, opts);
}
