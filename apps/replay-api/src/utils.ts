export const toDataURI = (
  bytes: Uint8Array,
  mime = "application/octet-stream"
) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
