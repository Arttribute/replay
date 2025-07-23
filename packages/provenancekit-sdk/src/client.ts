// packages/provenancekit-sdk/src/client.ts
import { Api, ApiClientOptions } from "./api";
import { ProvenanceKitError } from "./errors";
import type {
  UploadMatchResult,
  DuplicateDetails,
  ProvenanceBundle,
  ProvenanceGraph,
  Match,
} from "./types";
import { Session, SessionBundle } from "./types";

function asBlob(input: Blob | File | Buffer | Uint8Array): Blob {
  if (input instanceof Blob) return input;
  if (typeof Buffer !== "undefined" && input instanceof Buffer)
    return new Blob([input]);
  if (input instanceof Uint8Array) return new Blob([input]);
  throw new TypeError("Unsupported binary type");
}

export interface FileOpts {
  entity: {
    id?: string;
    role: string;
    name?: string;
    wallet?: string;
    publicKey?: string;
  };
  action?: {
    type?: string;
    inputCids?: string[];
    toolCid?: string;
    proof?: string;
    extensions?: Record<string, any>;
  };
  resourceType?: string;
  sessionId?: string; // NEW
}

export interface UploadOptions {
  type?: string;
  topK?: number;
  min?: number;
}

export interface FileResult {
  cid: string;
  actionId?: string;
  entityId?: string;
  duplicate?: DuplicateDetails;
  matched?: Match;
}

export class ProvenanceKit {
  private readonly api: Api;
  readonly unclaimed = "ent:unclaimed";

  constructor(opts: ApiClientOptions = {}) {
    this.api = new Api(opts);
  }

  private form(file: Blob | File | Buffer | Uint8Array, json: unknown) {
    const f = new FormData();
    f.append("file", asBlob(file), (file as any).name ?? "file.bin");
    f.append("json", JSON.stringify(json));
    return f;
  }

  uploadAndMatch(
    file: Blob | File | Buffer | Uint8Array,
    o: UploadOptions = {}
  ) {
    const qs = `topK=${o.topK ?? 5}&min=${o.min ?? 0}${
      o.type ? `&type=${o.type}` : ""
    }`;
    const form = new FormData();
    form.append("file", asBlob(file), (file as any).name ?? "file.bin");
    return this.api.postForm<UploadMatchResult>(`/search/file?${qs}`, form);
  }

  async file(
    file: Blob | File | Buffer | Uint8Array,
    opts: FileOpts,
    dedup: { type?: string; minScore?: number } = {}
  ): Promise<FileResult> {
    try {
      const res = await this.api.postForm<{
        cid: string;
        actionId: string;
        entityId: string;
      }>("/activity", this.form(file, opts));
      return { ...res };
    } catch (e) {
      if (e instanceof ProvenanceKitError && e.code === "Duplicate") {
        const d = e.details as DuplicateDetails;
        return {
          cid: d.cid,
          duplicate: d,
          matched: {
            cid: d.cid,
            score: d.similarity,
            type: opts.resourceType ?? "unknown",
          },
        };
      }
      throw e;
    }
  }

  async tool(
    spec: Blob | File | Buffer | Uint8Array,
    meta: { name?: string; sessionId?: string }
  ) {
    const res = await this.file(spec, {
      entity: { role: "organization", name: meta.name ?? "Tool Publisher" },
      resourceType: "tool",
      sessionId: meta.sessionId,
    });
    return res.cid;
  }

  provenance(cid: string, depth = 10) {
    return this.api.get<ProvenanceBundle>(`/provenance/${cid}?depth=${depth}`);
  }
  graph(cid: string, depth = 10) {
    return this.api.get<ProvenanceGraph>(`/graph/${cid}?depth=${depth}`);
  }

  async entity(e: {
    role: string;
    name?: string;
    wallet?: string;
    publicKey?: string;
  }) {
    const r = await this.api.postJSON<{ id: string }>("/entity", e);
    return r.id;
  }

  /* -------- NEW: sessions ---------- */
  async createSession(title?: string, metadata?: any) {
    const r = await this.api.postJSON<{ id: string }>("/session", {
      title,
      metadata,
    });
    return r.id;
  }

  closeSession(id: string) {
    return this.api.postJSON<{ ok: true }>(`/session/${id}/close`, {});
  }

  async addSessionMessage(sessionId: string, content: any, entityId?: string) {
    const r = await this.api.postJSON<{ messageId: string }>(
      `/session/${sessionId}/message`,
      {
        content,
        entityId,
      }
    );
    return r.messageId;
  }

  getSession(id: string) {
    return this.api.get<SessionBundle>(`/session/${id}`);
  }
}
