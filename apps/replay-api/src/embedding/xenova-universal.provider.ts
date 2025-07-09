import {
	AutoTokenizer,
	CLIPTextModelWithProjection,
	pipeline,
} from "@xenova/transformers";
//import { WaveFile } from "wavefile";
import type { EmbeddingProvider } from "./provider.js";

type Vec = number[];

/* -- helper: detect mime from 1-2 byte signatures (minimal) -------------- */
function sniffMime(b64orUrl: string): string {
	if (b64orUrl.startsWith("data:")) {
		const m = b64orUrl.slice(5, b64orUrl.indexOf(";"));
		return m || "application/octet-stream";
	}
	if (b64orUrl.startsWith("http")) return "application/octet-stream";
	return "application/octet-stream";
}

export class XenovaUniversalProvider implements EmbeddingProvider {
	private readonly vision = "Xenova/clip-vit-base-patch16";
	private readonly audio = "Xenova/larger_clap_general";

	private textCache?: { tok: any; mdl: any };
	private imgPipe?: any;
	private vidPipe?: any;
	private audCache?: { proc: any; mdl: any };

	/* ───────── LOADERS ───────── */
	private async loadText() {
		if (!this.textCache) {
			this.textCache = {
				tok: await AutoTokenizer.from_pretrained(this.vision),
				mdl: await CLIPTextModelWithProjection.from_pretrained(this.vision),
			};
		}
		return this.textCache;
	}
	private async loadImg() {
		if (!this.imgPipe)
			this.imgPipe = await pipeline("image-feature-extraction", this.vision);
		return this.imgPipe;
	}
	private async loadVid() {
		if (!this.vidPipe)
			this.vidPipe = await pipeline(
				"video-feature-extraction" as any,
				this.vision,
			);
		return this.vidPipe;
	}
	private async loadAud() {
		if (!this.audCache) {
			const { AutoProcessor, ClapAudioModelWithProjection } = await import(
				"@xenova/transformers"
			);
			this.audCache = {
				proc: await AutoProcessor.from_pretrained(this.audio),
				mdl: await ClapAudioModelWithProjection.from_pretrained(this.audio),
			};
		}
		return this.audCache;
	}

	/* ───────── TEXT ───────── */
	async encodeText(text: string): Promise<Vec> {
		const { tok, mdl } = await this.loadText();
		const inp = tok([text], { padding: true, truncation: true });
		const { text_embeds } = await mdl(inp, {
			pooling: "mean",
			normalize: true,
		});
		return Array.from(text_embeds.data as Float32Array);
	}

	/* ───────── IMAGE ───────── */
	async encodeImage(src: string): Promise<Vec> {
		// src must already be data: or http/https/… URL
		const out = await (await this.loadImg())(src, {
			pooling: "mean",
			normalize: true,
		});
		return Array.from(out.data as Float32Array);
	}

	/* ───────── VIDEO ───────── */
	async encodeVideo(src: string): Promise<Vec> {
		const out = await (await this.loadVid())(src, {
			pooling: "mean",
			normalize: true,
		});
		return Array.from(out.data as Float32Array);
	}

	/* ───────── AUDIO ───────── */
	//   async encodeAudio(src: string): Promise<Vec> {
	//     const { proc, mdl } = await this.loadAud();

	//     const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
	//     const wav   = new WaveFile(Buffer.from(bytes));
	//     wav.toBitDepth("32f");
	//     wav.toSampleRate(48000);
	//     const mono  = (wav.getSamples() as Float32Array[])[0];

	//     const inputs        = await proc(mono);
	//     const { audio_embeds } = await mdl(inputs, { pooling: "mean", normalize: true });
	//     return Array.from(audio_embeds.data as Float32Array);
	//   }
}
