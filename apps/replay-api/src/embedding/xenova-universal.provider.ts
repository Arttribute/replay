import {
  pipeline,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  ClapAudioModelWithProjection,
} from "@xenova/transformers";

import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";
import WavefileMod from "wavefile";

import type { EmbeddingProvider } from "./provider";

type Vec = number[];
const WaveFile = WavefileMod.WaveFile;
/* ---------- helpers ---------- */
function mimeToExt(mime: string): string {
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("mp3")) return ".mp3";
  if (mime.includes("wav")) return ".wav";
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

  /* CLAP for audio ----------------------------------------------- */
  private clapProcessor?: any;
  private clapModel?: any;

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

  private async lClap() {
    if (!this.clapProcessor) {
      this.clapProcessor = await AutoProcessor.from_pretrained(
        "Xenova/larger_clap_general"
      );
      this.clapModel = await ClapAudioModelWithProjection.from_pretrained(
        "Xenova/larger_clap_general"
      );
    }
    return { proc: this.clapProcessor, mdl: this.clapModel };
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
      console.log("Image embedding output:", out);
      return Array.from(out.data as Float32Array);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }

  async encodeAudio(src: string): Promise<Vec> {
    const { bytes, mime } = await toBytes(src);
    const base = join(tmpdir(), randomUUID());
    const inPath = base + mimeToExt(mime);
    await writeFile(inPath, bytes);

    /* always end up with mono 48-kHz WAV for CLAP */
    const wavPath = mime.includes("wav") ? inPath : `${base}.wav`;
    if (!mime.includes("wav")) {
      await new Promise<void>((res, rej) =>
        ffmpeg(inPath)
          .audioChannels(1)
          .audioFrequency(48_000)
          .audioCodec("pcm_s16le")
          .format("wav")
          .on("end", () => res())
          .on("error", rej)
          .save(wavPath)
      );
    }

    try {
      /* decode WAV → Float32Array */
      const wav = new WaveFile(await readFile(wavPath));
      wav.toBitDepth("32f");
      wav.toSampleRate(48_000);
      const samples = wav.getSamples();
      const pcm = new Float32Array(samples as Float64Array); // mono

      /* CLAP embedding */
      const { proc, mdl } = await this.lClap();
      const inputs = await proc(pcm); // handles padding etc.
      const { audio_embeds } = await mdl(inputs, {
        pooling: "mean",
        normalize: true,
      });
      console.log("Audio embedding output:", audio_embeds);
      return Array.from(audio_embeds.data as Float32Array);
    } finally {
      unlink(inPath).catch(() => {});
      if (wavPath !== inPath) unlink(wavPath).catch(() => {});
    }
  }

  async encodeVideo(_: string): Promise<Vec> {
    throw new Error("Video embedding not yet implemented");
  }
}
