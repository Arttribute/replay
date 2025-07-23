// packages/provenancekit-openai/src/wrapper.ts
import OpenAI, { type ClientOptions as OpenAIClientOptions } from "openai";
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

import type {
  Images,
  ImageGenerateParams,
  ImageEditParams,
  ImageCreateVariationParams,
} from "openai/resources/images";

import type { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";
import type { SpeechCreateParams } from "openai/resources/audio/speech";

import {
  ProvenanceKit,
  type FileOpts,
  type FileResult,
  type DuplicateDetails,
  type ApiClientOptions as ProvClientOptions,
} from "@provenancekit/sdk";

import { base64ToBytes, fetchBytes, utf8 } from "./utils.js";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type ProvInit = { client: ProvenanceKit } | ProvClientOptions;

type ImageProv = Awaited<ReturnType<Images["generate"]>> & {
  provenance: Array<FileResult | { duplicate: DuplicateDetails }>;
};

export type ToolRunner = (name: string, args: any) => Promise<unknown>;

export interface ChatProvReturn {
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
  actions: Array<{
    actionId: string;
    type: string;
    toolUsedCid?: string | null;
  }>;
  finalOutputCids: string[];
}

/* ------------------------------------------------------------------ */
/* Wrapper Class                                                      */
/* ------------------------------------------------------------------ */

export class OpenAIWithProvenance {
  readonly openai: OpenAI;
  readonly pk: ProvenanceKit;

  constructor(openaiOpts: OpenAIClientOptions, provenance: ProvInit = {}) {
    this.openai = new OpenAI(openaiOpts);
    this.pk =
      "client" in provenance
        ? provenance.client
        : new ProvenanceKit(provenance);
  }

  /* ------------------------------ */
  /*           INTERNALS            */
  /* ------------------------------ */

  /** Caches tool spec -> CID */
  private _toolCache = new Map<string, string>();

  private async ensureToolResource(
    name: string,
    spec: unknown,
    baseProv: Partial<FileOpts>
  ): Promise<string> {
    const key = `${name}:${JSON.stringify(spec)}`;
    const cached = this._toolCache.get(key);
    if (cached) return cached;

    const res = await this.pk.file(utf8(JSON.stringify(spec)), {
      ...baseProv,
      resourceType: "tool",
      entity: {
        role: "organization",
        name,
        ...baseProv.entity,
      },
      action: {
        type: "tool.definition",
        ...baseProv.action,
      },
    });

    this._toolCache.set(key, res.cid);
    return res.cid;
  }

  /** Store a prompt (text) as a resource */
  private async storePrompt(
    text: string,
    baseProv: Partial<FileOpts>
  ): Promise<FileResult> {
    return this.pk.file(utf8(text), {
      ...baseProv,
      resourceType: "text",
      entity: {
        role: baseProv.entity?.role ?? "human",
        name: baseProv.entity?.name ?? "user",
        ...baseProv.entity,
      },
      action: {
        type: "prompt.text",
        ...baseProv.action,
      },
    });
  }

  /** Helper to store arbitrary text output (assistant or tool results) */
  private async storeTextOutput(
    text: string,
    type: string,
    inputCids: string[],
    toolCid: string | undefined,
    baseProv: Partial<FileOpts>,
    entityRole: "ai" | "tool" = "ai",
    entityName?: string
  ): Promise<FileResult> {
    return this.pk.file(utf8(text), {
      ...baseProv,
      resourceType: "text",
      entity: {
        role: entityRole,
        name: entityName ?? baseProv.entity?.name ?? "openai",
        ...baseProv.entity,
      },
      action: {
        type,
        inputCids,
        toolCid,
        ...baseProv.action,
      },
    });
  }

  /** Helper for binary outputs (image/audio/...) */
  private async storeBinaryOutput(
    bytes: Uint8Array,
    kind: "image" | "audio" | "video",
    type: string,
    inputCids: string[],
    toolCid: string | undefined,
    baseProv: Partial<FileOpts>,
    entityName?: string
  ): Promise<FileResult> {
    return this.pk.file(bytes, {
      ...baseProv,
      resourceType: kind,
      entity: {
        role: "ai",
        name: entityName ?? baseProv.entity?.name ?? "openai",
        ...baseProv.entity,
      },
      action: {
        type,
        inputCids,
        toolCid,
        ...baseProv.action,
      },
    });
  }

  /* ================================================================
   *  CHAT (tool calling included)
   * ================================================================ */

  async chatWithProvenance(
    params: ChatCompletionCreateParams,
    runTool: ToolRunner,
    baseProv: Partial<FileOpts> = {}
  ): Promise<ChatProvReturn> {
    // Persist each message separately (better lineage)
    const inputCids: string[] = [];
    for (const m of params.messages) {
      const cidRes = await this.storePrompt(
        JSON.stringify(m),
        // message role decides entity role
        {
          ...baseProv,
          entity: {
            ...baseProv.entity,
            role: m.role === "user" ? "human" : "ai",
            name: m.role,
          },
          action: { type: `chat.input.${m.role}` },
        }
      );
      inputCids.push(cidRes.cid);
    }

    const actions: ChatProvReturn["actions"] = [];
    let messages: ChatCompletionMessageParam[] = [...params.messages];
    let loop = 0;
    let lastCompletion:
      | Awaited<ReturnType<typeof this.openai.chat.completions.create>>
      | undefined;

    while (true) {
      loop++;
      if (loop > 20) throw new Error("Too many tool loops");

      lastCompletion = await this.openai.chat.completions.create({
        ...params,
        messages,
        stream: false,
      });

      const comp =
        lastCompletion as import("openai/resources/chat/completions").ChatCompletion;
      const msg = comp.choices[0].message;

      if (!msg.tool_calls?.length) {
        // final assistant text
        const outRes = await this.storeTextOutput(
          msg.content ?? "",
          "openai.chat.final",
          inputCids,
          undefined,
          baseProv,
          "ai",
          params.model ?? "openai"
        );

        actions.push({
          actionId: outRes.actionId ?? "",
          type: "openai.chat.final",
          toolUsedCid: null,
        });

        return {
          completion: lastCompletion,
          actions,
          finalOutputCids: [outRes.cid],
        };
      }

      // has tool calls
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        const argsStr = tc.function.arguments ?? "{}";

        // Register tool definition
        const toolSchema = params.tools?.find(
          (t) => t.type === "function" && t.function?.name === toolName
        );
        if (!toolSchema) throw new Error(`Unknown tool: ${toolName}`);

        const toolCid = await this.ensureToolResource(
          toolName,
          toolSchema,
          baseProv
        );

        // Store arguments text
        const argsRes = await this.storeTextOutput(
          argsStr,
          "openai.tool.call.args",
          inputCids,
          toolCid,
          baseProv,
          "ai",
          params.model ?? "openai"
        );

        // Execute tool
        const result = await runTool(toolName, JSON.parse(argsStr));
        const resultStr =
          typeof result === "string" ? result : JSON.stringify(result);

        // Store tool result
        const resultRes = await this.storeTextOutput(
          resultStr,
          "tool.exec",
          [argsRes.cid],
          toolCid,
          baseProv,
          "tool",
          toolName
        );

        actions.push({
          actionId: resultRes.actionId ?? "",
          type: "tool.exec",
          toolUsedCid: toolCid,
        });

        // feed back to model
        messages.push(msg);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        });

        inputCids.push(resultRes.cid);
      }
    }
  }

  /* ================================================================
   *  IMAGES
   * ================================================================ */

  async generateImageWithProvenance(
    params: ImageGenerateParams,
    prov?: Partial<FileOpts>
  ): Promise<ImageProv> {
    // 1. Prompt resource (human provided)
    const promptRes = await this.storePrompt(params.prompt, {
      ...prov,
      entity: { role: "human", name: "user", ...prov?.entity },
      action: { type: "prompt.text", ...prov?.action },
    });

    // 2. Register the tool (DALL·E etc.)
    const toolCid = await this.ensureToolResource(
      params.model ?? "dalle",
      { kind: "image.generate", model: params.model },
      prov ?? {}
    );

    // 3. AI calls image tool
    const out = await this.openai.images.generate(params);

    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

    for (const d of out.data ?? []) {
      let bytes: Uint8Array | undefined;
      if ("b64_json" in d && d.b64_json) bytes = base64ToBytes(d.b64_json);
      else if ("url" in d && d.url) bytes = await fetchBytes(d.url);
      if (!bytes) continue;

      const imageRes = await this.storeBinaryOutput(
        bytes,
        "image",
        "openai.image.output",
        [promptRes.cid],
        toolCid,
        prov ?? {},
        params.model ?? "openai"
      );
      console.log("Generated image:", imageRes);
      provResults.push(imageRes);
    }

    return { ...out, provenance: provResults };
  }

  async editImageWithProvenance(
    params: ImageEditParams,
    prov?: Partial<FileOpts>
  ): Promise<ImageProv> {
    const promptText = params.prompt ?? "(image edit)";
    const promptRes = await this.storePrompt(promptText, {
      ...prov,
      entity: { role: "human", name: "user", ...prov?.entity },
      action: { type: "prompt.text", ...prov?.action },
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "dalle-edit",
      { kind: "image.edit", model: params.model },
      prov ?? {}
    );

    const out = await this.openai.images.edit(params);
    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

    for (const d of out.data ?? []) {
      let bytes: Uint8Array | undefined;
      if ("b64_json" in d && d.b64_json) bytes = base64ToBytes(d.b64_json);
      else if ("url" in d && d.url) bytes = await fetchBytes(d.url);
      if (!bytes) continue;

      const imageRes = await this.storeBinaryOutput(
        bytes,
        "image",
        "openai.image.output",
        [promptRes.cid],
        toolCid,
        prov ?? {},
        params.model ?? "openai"
      );
      provResults.push(imageRes);
    }

    return { ...out, provenance: provResults };
  }

  async createImageVariationWithProvenance(
    params: ImageCreateVariationParams,
    prov?: Partial<FileOpts>
  ): Promise<ImageProv> {
    const promptRes = await this.storePrompt("(variation)", {
      ...prov,
      entity: { role: "human", name: "user", ...prov?.entity },
      action: { type: "prompt.text", ...prov?.action },
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "dalle-var",
      { kind: "image.variation", model: params.model },
      prov ?? {}
    );

    const out = await this.openai.images.createVariation(params);
    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

    for (const d of out.data ?? []) {
      let bytes: Uint8Array | undefined;
      if ("b64_json" in d && d.b64_json) bytes = base64ToBytes(d.b64_json);
      else if ("url" in d && d.url) bytes = await fetchBytes(d.url);
      if (!bytes) continue;

      const imageRes = await this.storeBinaryOutput(
        bytes,
        "image",
        "openai.image.output",
        [promptRes.cid],
        toolCid,
        prov ?? {},
        params.model ?? "openai"
      );
      provResults.push(imageRes);
    }

    return { ...out, provenance: provResults };
  }

  /* ================================================================
   *  AUDIO (TTS / STT)
   * ================================================================ */

  async ttsWithProvenance(
    params: SpeechCreateParams,
    prov?: Partial<FileOpts>
  ): Promise<{
    response: Response;
    provenance: FileResult | { duplicate: DuplicateDetails };
  }> {
    // prompt text (the input)
    const promptRes = await this.storePrompt(params.input, {
      ...prov,
      entity: { role: "human", name: "user", ...prov?.entity },
      action: { type: "prompt.text", ...prov?.action },
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "tts-tool",
      { kind: "audio.tts", model: params.model },
      prov ?? {}
    );

    const rsp = await this.openai.audio.speech.create(params);
    const bytes = new Uint8Array(await rsp.arrayBuffer());

    const audioRes = await this.storeBinaryOutput(
      bytes,
      "audio",
      "openai.tts.output",
      [promptRes.cid],
      toolCid,
      prov ?? {},
      params.model ?? "openai"
    );

    return { response: rsp, provenance: audioRes };
  }

  async sttWithProvenance(
    params: TranscriptionCreateParams,
    prov?: Partial<FileOpts>
  ): Promise<
    Awaited<ReturnType<OpenAI["audio"]["transcriptions"]["create"]>> & {
      provenance: FileResult | { duplicate: DuplicateDetails };
    }
  > {
    // Tool spec
    const toolCid = await this.ensureToolResource(
      params.model ?? "whisper",
      { kind: "audio.stt", model: params.model },
      prov ?? {}
    );

    const rsp = await this.openai.audio.transcriptions.create({
      ...params,
      stream: false,
    });

    // Store text result
    const textRes = await this.storeTextOutput(
      rsp.text,
      "openai.stt.output",
      [], // could include original audio cid if you stored it first
      toolCid,
      prov ?? {},
      "ai",
      params.model ?? "openai"
    );

    return { ...rsp, provenance: textRes };
  }
}
