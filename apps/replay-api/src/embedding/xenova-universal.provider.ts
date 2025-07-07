import {
  pipeline,
  AutoTokenizer,
  CLIPTextModelWithProjection,
} from "@xenova/transformers";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { writeFile, unlink } from "node:fs/promises";
import type { EmbeddingProvider } from "./provider.ts";

type Vec = number[];

/* ---------- helpers ---------- */
function mimeToExt(mime: string): string {
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  return ".bin";
}

/** data:… → {bytes, mime}  |  http(s) → {bytes, mime=""} */
async function toBytes(src: string): Promise<{ bytes: Buffer; mime: string }> {
  if (src.startsWith("data:")) {
    const mid = src.indexOf(",");
    const meta = src.slice(5, mid); // e.g. image/png;base64
    const mime = meta.split(";")[0] || "application/octet-stream";
    const buf = Buffer.from(src.slice(mid + 1), "base64");
    return { bytes: buf, mime };
  }
  // http / https
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch ${src}: ${res.status}`);
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return { bytes: buf, mime };
}

/* ===================================================================== */
/*                           Provider implementation                     */
/* ===================================================================== */
export class XenovaUniversalProvider implements EmbeddingProvider {
  private readonly vision = "Xenova/clip-vit-base-patch16";

  private textCache?: { tok: any; mdl: any };
  private imgPipe?: any;

  /* ---------- lazy loaders ---------- */
  private async lText() {
    if (!this.textCache) {
      this.textCache = {
        tok: await AutoTokenizer.from_pretrained(this.vision),
        mdl: await CLIPTextModelWithProjection.from_pretrained(this.vision),
      };
    }
    return this.textCache;
  }
  private async lImg() {
    if (!this.imgPipe)
      this.imgPipe = await pipeline("image-feature-extraction", this.vision);
    return this.imgPipe;
  }

  /* ---------- TEXT ---------- */
  async encodeText(text: string): Promise<Vec> {
    const { tok, mdl } = await this.lText();
    const inp = tok([text], { padding: true, truncation: true });
    const { text_embeds } = await mdl(inp, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(text_embeds.data as Float32Array);
  }

  /* ---------- IMAGE ---------- */
  async encodeImage(src: string): Promise<Vec> {
    // 1. Get bytes + mime
    const { bytes, mime } = await toBytes(src);

    // 2. Write to a temporary file
    const tmpPath = `${tmpdir()}/${randomUUID()}${mimeToExt(mime)}`;
    await writeFile(tmpPath, bytes);

    // 3. Run pipeline with *file path string* (works on all platforms)
    try {
      const out = await (
        await this.lImg()
      )(tmpPath, {
        pooling: "mean",
        normalize: true,
      });
      return Array.from(out.data as Float32Array);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }

  /* ---------- stubs for other modalities ---------- */
  async encodeVideo(_: string): Promise<Vec> {
    throw new Error("Video embedding not yet implemented");
  }
  async encodeAudio(_: string): Promise<Vec> {
    throw new Error("Audio embedding not yet implemented");
  }
}
