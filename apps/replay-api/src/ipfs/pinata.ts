import { PinataSDK } from "pinata";
import { sha256 } from "multiformats/hashes/sha2";
import { toString as u8ToHex } from "uint8arrays/to-string";
import "dotenv/config";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.GATEWAY_URL,
});

console.log("Pinata jwt:", process.env.PINATA_JWT ? "set" : "not set");

// src/ipfs/pinata.ts
export async function pinBytes(
  bytes: Uint8Array,
  filename: string, // <- must not be ""
  mime = "application/octet-stream"
) {
  if (!filename) filename = `file-${Date.now()}`; // fallback

  const file = new File([bytes], filename, { type: mime });

  const { cid, size } = await pinata.upload.public.file(file, {
    metadata: { name: filename }, // ❤ explicit
  });

  const digest = await sha256.digest(bytes);
  return { cid, size, hashHex: u8ToHex(digest.bytes) };
}

export const fetchViaGateway = (cid: string) =>
  pinata.gateways.public.get(cid).then((r) => r.data);
