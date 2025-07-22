/* -----------------------------------------------------------
 *  Tiny helpers shared by the wrapper
 * --------------------------------------------------------- */

/** UTF‑8 encode a JS string into a Uint8Array (browser & Node) */
export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** base64 → Uint8Array  (handles URL‑safe & padding) */
export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    /* browser / edge‑runtime */
    const bin = atob(b64.replace(/_/g, "/").replace(/-/g, "+"));
    return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
  }
  /* Node */
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

/** Fetch a remote (signed) URL into raw bytes */
export async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf;
}
