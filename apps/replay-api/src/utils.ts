import { readFile } from "node:fs/promises";
import WavefileMod from "wavefile";
const WaveFile = WavefileMod.WaveFile;

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

/**
 * Decode a WAV (any bit-depth, any channel-count) into
 * a mono Float32Array at 16 kHz – the format the Wav2Vec2
 * processor expects.
 */
export async function wavToFloat32(path: string): Promise<Float32Array> {
  const buf = await readFile(path);
  const wav = new WaveFile(buf);

  // resample to 16 kHz if needed (Wav2Vec base expects 16k)
  if ((wav.fmt as any).sampleRate !== 16000) wav.toSampleRate(16000);
  // convert to 32-bit float
  if (wav.bitDepth !== "32f") wav.toBitDepth("32f");

  let samples = new Float32Array(wav.getSamples() as Float64Array);

  // If stereo, average channels ➜ mono
  if ((wav.fmt as any).numChannels > 1) {
    const numChannels = (wav.fmt as any).numChannels;
    const monoSamples = new Float32Array(samples.length / numChannels);
    for (let i = 0; i < monoSamples.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += samples[i * numChannels + ch];
      }
      monoSamples[i] = sum / numChannels;
    }
    samples = monoSamples;
  }

  return samples;
}
