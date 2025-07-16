import OpenAI, {
  Images,
  Audio,
  ImagesGenerateParams,
  ImagesEditParams,
  ImagesCreateVariationParams,
  AudioSpeechCreateParams,
  AudioTranscriptionsCreateParams,
} from "openai";
import {
  ProvenanceKit,
  FileOpts,
  FileResult,
  DuplicateDetails,
} from "@provenancekit/sdk";
import { base64ToBytes, fetchBytes, utf8 } from "./utils.js";

type ProvInit =
  | { client: ProvenanceKit } // already created
  | import("@provenancekit/sdk").ApiClientOptions; // lazily create

/* -----------------------------------------------------------
 *  Wrapper class
 * --------------------------------------------------------- */
export class OpenAIWithProvenance extends OpenAI {
  #pk: ProvenanceKit;

  constructor(
    openaiOpts: ConstructorParameters<typeof OpenAI>[0],
    provenance: ProvInit = {}
  ) {
    super(openaiOpts);
    this.#pk =
      "client" in provenance
        ? provenance.client
        : new ProvenanceKit(provenance);
  }

  /* ----------------------------------------------------------------
   *  IMAGES
   * ---------------------------------------------------------------- */
  override readonly images = {
    ...super.images,

    /* ---------- generations (images.generate) ------------------- */
    generateWithProvenance: async (
      params: ImagesGenerateParams,
      prov?: Partial<FileOpts>
    ): Promise<
      Awaited<ReturnType<Images["generate"]>> & {
        provenance: Array<FileResult | { duplicate: DuplicateDetails }>;
      }
    > => {
      const out = await super.images.generate(params);
      const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

      for (const d of out.data) {
        let bytes: Uint8Array | undefined;

        if ("b64_json" in d && d.b64_json) {
          bytes = base64ToBytes(d.b64_json);
        } else if ("url" in d && d.url) {
          bytes = await fetchBytes(d.url);
        }

        if (!bytes) continue; // should not happen

        const res = await this.#pk.file(bytes, {
          entity: {
            role: "ai",
            name: params.model ?? "openai",
            ...prov?.entity,
          },
          action: {
            type: "openai.image.generate",
            extensions: { prompt: params.prompt },
            ...prov?.action,
          },
          resourceType: "image",
          ...prov,
        });

        provResults.push(res);
      }

      return { ...out, provenance: provResults };
    },

    /* ---------- edits ------------------------------------------- */
    editWithProvenance: async (
      params: ImagesEditParams,
      prov?: Partial<FileOpts>
    ) => {
      const rsp = await super.images.edit(params);
      return this.images.generateWithProvenance(
        { ...params, prompt: params.prompt ?? "" },
        prov
      );
    },

    /* ---------- variations ------------------------------------- */
    createVariationWithProvenance: async (
      params: ImagesCreateVariationParams,
      prov?: Partial<FileOpts>
    ) => {
      const rsp = await super.images.createVariation(params);
      return this.images.generateWithProvenance(
        { ...params, prompt: "(variation)" },
        prov
      );
    },
  } as const satisfies Images & {
    generateWithProvenance: any;
    editWithProvenance: any;
    createVariationWithProvenance: any;
  };

  /* ----------------------------------------------------------------
   *  AUDIO  – TTS  (audio.speech.create)
   * ---------------------------------------------------------------- */
  override readonly audio = {
    ...super.audio,
    speech: {
      ...super.audio.speech,
      /** TTS + provenance */
      createWithProvenance: async (
        params: AudioSpeechCreateParams,
        prov?: Partial<FileOpts>
      ) => {
        const rsp = await super.audio.speech.create(params);
        const bytes = new Uint8Array(await rsp.arrayBuffer());

        const res = await this.#pk.file(bytes, {
          entity: {
            role: "ai",
            name: params.model ?? "openai",
            ...prov?.entity,
          },
          action: {
            type: "openai.tts",
            extensions: { input: params.input, voice: params.voice },
            ...prov?.action,
          },
          resourceType: "audio",
          ...prov,
        });

        return { response: rsp, provenance: res };
      },
    },
    transcriptions: {
      ...super.audio.transcriptions,
      /** STT + provenance (stores the transcript text) */
      createWithProvenance: async (
        params: AudioTranscriptionsCreateParams,
        prov?: Partial<FileOpts>
      ) => {
        const rsp = await super.audio.transcriptions.create(params);

        /* store transcript as a *text* resource */
        const res = await this.#pk.file(utf8(rsp.text), {
          entity: {
            role: "ai",
            name: params.model ?? "openai",
            ...prov?.entity,
          },
          action: {
            type: "openai.stt",
            extensions: { language: params.language ?? "auto" },
            ...prov?.action,
          },
          resourceType: "text",
          ...prov,
        });

        return { ...rsp, provenance: res };
      },
    },
  } as const;
}
