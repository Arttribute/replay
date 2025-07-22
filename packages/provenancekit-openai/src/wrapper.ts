// src/openai-with-provenance.ts
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

/** Let callers pass an already-created ProvenanceKit or the options to create one */
type ProvInit = { client: ProvenanceKit } | ProvClientOptions;

/** Image helper return type */
type ImageProv = Awaited<ReturnType<Images["generate"]>> & {
  provenance: Array<FileResult | { duplicate: DuplicateDetails }>;
};

/** Minimal tool runner interface you provide */
export type ToolRunner = (name: string, args: any) => Promise<unknown>;

/** Provenance return shape for chat */
export interface ChatProvReturn {
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
  /** Every action we recorded, in order */
  actions: Array<{
    actionId: string;
    type: string;
    toolUsedCid?: string | null;
  }>;
  /** CIDs of the final assistant message text + any files we wrote */
  finalOutputCids: string[];
}

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

  /* ================================================================
   *  CHAT + TOOL CALLING (GRANULAR ACTIONS)
   * ================================================================ */

  /**
   * Chat completion with provenance and granular tool-call actions.
   *
   * @param params     Standard OpenAI chat params (tools allowed).
   * @param runTool    Your dispatcher that executes a tool locally/remote.
   * @param baseProv   Defaults for ProvenanceKit calls (entity, etc.)
   */
  async chatWithProvenance(
    params: ChatCompletionCreateParams,
    runTool: ToolRunner,
    baseProv: Partial<FileOpts> = {}
  ): Promise<ChatProvReturn> {
    // 1) persist incoming messages as a single text blob (or one per message if you prefer)
    const promptText = JSON.stringify(params.messages);
    const promptRes = await this.pk.file(utf8(promptText), {
      ...baseProv,
      resourceType: "text",
      entity: {
        role: "user", // or mix if you split by role
        name: "conversation",
        ...baseProv.entity,
      },
      action: {
        type: "input.messages",
        ...baseProv.action,
      },
    });

    const actions: ChatProvReturn["actions"] = [];
    const inputCidsRoot = [promptRes.cid];

    // Work on a mutable copy of messages as we loop tool calls.
    const messages: ChatCompletionMessageParam[] = [...params.messages];

    let loopGuard = 0;
    let lastCompletion:
      | Awaited<ReturnType<typeof this.openai.chat.completions.create>>
      | undefined;

    while (true) {
      loopGuard++;
      if (loopGuard > 20) {
        throw new Error("Too many tool loops (safety guard).");
      }

      lastCompletion = await this.openai.chat.completions.create({
        ...params,
        messages,
        stream: false, // Ensure non-streaming response
      });

      // Type assertion to satisfy TypeScript that this is a non-streaming response
      const nonStreamCompletion =
        lastCompletion as import("openai/resources/chat/completions").ChatCompletion;
      const choice = nonStreamCompletion.choices[0];
      const msg = choice.message;

      // No tool calls → we are done. Store final assistant message.
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const outText = msg.content ?? "";
        // store assistant text
        const outRes = await this.pk.file(utf8(outText), {
          ...baseProv,
          resourceType: "text",
          entity: {
            role: "ai",
            name: params.model ?? "openai",
            ...baseProv.entity,
          },
          action: {
            type: "openai.chat.final",
            inputCids: inputCidsRoot, // includes the prompt + tool results
            ...baseProv.action,
          },
        });

        actions.push({
          actionId: outRes.actionId ?? "",
          type: "openai.chat.final",
          toolUsedCid: null,
        });

        messages.push(msg); // push assistant message if caller wants to continue
        return {
          completion: lastCompletion,
          actions,
          finalOutputCids: [outRes.cid],
        };
      }

      // One or more tool calls in this assistant turn.
      // Because you want ONE tool per action, we'll execute each call separately,
      // each with its own action & tool_used CID.
      for (const tc of msg.tool_calls) {
        const name = tc.function.name;
        const argsStr = tc.function.arguments ?? "{}";

        // Persist the tool descriptor (name/schema) AS A RESOURCE once per name (basic cache):
        const toolSchema = params.tools?.find(
          (t) => t.type === "function" && t.function?.name === name
        );
        if (!toolSchema) throw new Error(`Unknown tool: ${name}`);

        const toolSchemaCid = await this._ensureToolResource(
          toolSchema,
          baseProv
        );

        // args blob resource
        const argsRes = await this.pk.file(utf8(argsStr), {
          ...baseProv,
          resourceType: "text",
          entity: {
            role: "ai",
            name: params.model ?? "openai",
            ...baseProv.entity,
          },
          action: {
            type: "openai.tool.call.args",
            inputCids: inputCidsRoot,
            ...baseProv.action,
          },
        });

        // execute tool
        const result = await runTool(name, JSON.parse(argsStr));
        const resultStr =
          typeof result === "string" ? result : JSON.stringify(result);

        // result resource
        const resultRes = await this.pk.file(utf8(resultStr), {
          ...baseProv,
          resourceType: "text",
          entity: {
            role: "tool",
            name,
            ...baseProv.entity,
          },
          action: {
            type: "tool.exec",
            inputCids: [argsRes.cid],
            toolCid: toolSchemaCid, // <— single CID as per your rule
            ...baseProv.action,
          },
        });

        actions.push({
          actionId: resultRes.actionId ?? "",
          type: "tool.exec",
          toolUsedCid: toolSchemaCid,
        });

        // Add the tool message so the model can see the result
        messages.push(msg); // assistant with tool_calls
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        });

        // Save result CID to feed into final AI action
        inputCidsRoot.push(resultRes.cid);
      }

      // loop will call OpenAI again with appended tool results
    }
  }

  /** Cache map (in-memory) to avoid re-storing same tool schema each call */
  private _toolCache = new Map<string, string>();
  private async _ensureToolResource(
    tool: NonNullable<ChatCompletionCreateParams["tools"]>[number],
    baseProv: Partial<FileOpts>
  ): Promise<string> {
    const key = JSON.stringify(tool);
    const cached = this._toolCache.get(key);
    if (cached) return cached;

    const res = await this.pk.file(utf8(key), {
      ...baseProv,
      resourceType: "text",
      entity: {
        role: "tool",
        name: tool.type === "function" ? tool.function?.name : tool.type,
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

  /* ================================================================
   *  IMAGES
   * ================================================================ */

  async generateImageWithProvenance(
    params: ImageGenerateParams,
    prov?: Partial<FileOpts>
  ): Promise<ImageProv> {
    const out = await this.openai.images.generate(params);
    const data = out.data ?? [];
    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

    for (const d of data) {
      let bytes: Uint8Array | undefined;

      if ("b64_json" in d && d.b64_json) {
        bytes = base64ToBytes(d.b64_json);
      } else if ("url" in d && d.url) {
        bytes = await fetchBytes(d.url);
      }

      if (!bytes) continue;

      const res = await this.pk.file(bytes, {
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
  }

  async editImageWithProvenance(
    params: ImageEditParams,
    prov?: Partial<FileOpts>
  ): Promise<ImageProv> {
    const out = await this.openai.images.edit(params);
    return this.generateImageWithProvenance(
      { ...params, prompt: params.prompt ?? "" },
      prov
    );
  }

  async createImageVariationWithProvenance(
    params: ImageCreateVariationParams,
    prov?: Partial<FileOpts>
  ): Promise<ImageProv> {
    const out = await this.openai.images.createVariation(params);
    return this.generateImageWithProvenance(
      { ...params, prompt: "(variation)" },
      prov
    );
  }

  /* ================================================================
   *  AUDIO
   * ================================================================ */

  async ttsWithProvenance(
    params: SpeechCreateParams,
    prov?: Partial<FileOpts>
  ): Promise<{
    response: Response;
    provenance: FileResult | { duplicate: DuplicateDetails };
  }> {
    const rsp = await this.openai.audio.speech.create(params);
    const bytes = new Uint8Array(await rsp.arrayBuffer());

    const res = await this.pk.file(bytes, {
      entity: {
        role: "ai",
        name: params.model ?? "openai",
        ...prov?.entity,
      },
      action: {
        type: "openai.tts",
        extensions: { input: params.input, voice: (params as any).voice },
        ...prov?.action,
      },
      resourceType: "audio",
      ...prov,
    });

    return { response: rsp, provenance: res };
  }

  async sttWithProvenance(
    params: TranscriptionCreateParams,
    prov?: Partial<FileOpts>
  ): Promise<
    Awaited<ReturnType<OpenAI["audio"]["transcriptions"]["create"]>> & {
      provenance: FileResult | { duplicate: DuplicateDetails };
    }
  > {
    const rsp = await this.openai.audio.transcriptions.create({
      ...params,
      stream: false,
    });

    const res = await this.pk.file(utf8(rsp.text), {
      entity: {
        role: "ai",
        name: params.model ?? "openai",
        ...prov?.entity,
      },
      action: {
        type: "openai.stt",
        extensions: { language: (params as any).language ?? "auto" },
        ...prov?.action,
      },
      resourceType: "text",
      ...prov,
    });

    return { ...rsp, provenance: res };
  }
}
