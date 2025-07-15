import { readFile } from "node:fs/promises";

export const toDataURI = (
  bytes: Uint8Array,
  mime = "application/octet-stream"
) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

/**  Guess “resource kind” from a MIME type  */
export function inferKindFromMime(
  mime: string
): "image" | "audio" | "video" | "text" | undefined {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return undefined;
}

/**  Turn a JS float[] into a pgvector literal  '[0.1,-0.2,…]' */
export function vecLiteral(v: number[]): string {
  // pgvector wants brackets and comma-separated decimals.
  return (
    "[" + v.map((x) => (Number.isFinite(x) ? x : 0).toFixed(6)).join(",") + "]"
  );
}
