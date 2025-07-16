import { Api, ApiClientOptions } from "./api";
import { ReplayError } from "./errors";
import type {
  UploadMatchResult,
  DuplicateDetails,
  ProvenanceBundle,
  ProvenanceGraph,
  Match,
} from "./types";

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
}

export interface UploadOptions {
  type?: string;
  topK?: number;
  min?: number;
}

/* -------- return structs -------- */
export interface FileResult {
  cid: string;
  actionId?: string;
  entityId?: string;
  duplicate?: DuplicateDetails;
  matched?: Match;
}

export class Replay {
  private readonly api: Api;
  readonly unclaimed = "ent:unclaimed";

  constructor(opts: ApiClientOptions = {}) {
    this.api = new Api(opts);
  }

  /* tiny helpers -------------------------------------------------- */
  private form(file: Blob | File | Buffer | Uint8Array, json: unknown) {
    const f = new FormData();
    f.append("file", asBlob(file), (file as any).name ?? "file.bin");
    f.append("json", JSON.stringify(json));
    return f;
  }

  /* 1️⃣  low‑level upload&match (no db write) -------------------- */
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

  /* 2️⃣  high‑level file() — the dev‑facing one ----------------- */
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
      return { ...res }; // brand‑new resource
    } catch (e) {
      if (e instanceof ReplayError && e.code === "Duplicate") {
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
      throw e; // bubble the rest
    }
  }

  /* 3️⃣  tool registration (dedup handled by .file) -------------- */
  async tool(spec: Blob | File | Buffer | Uint8Array, meta: { name?: string }) {
    const res = await this.file(spec, {
      entity: { role: "organization", name: meta.name ?? "Tool Publisher" },
      resourceType: "tool",
    });
    return res.cid;
  }

  /* 4️⃣  provenance helpers -------------------------------------- */
  provenance(cid: string, depth = 10) {
    return this.api.get<ProvenanceBundle>(`/provenance/${cid}?depth=${depth}`);
  }
  graph(cid: string, depth = 10) {
    return this.api.get<ProvenanceGraph>(`/graph/${cid}?depth=${depth}`);
  }

  /* 5️⃣  entity helper ------------------------------------------- */
  entity(e: {
    role: string;
    name?: string;
    wallet?: string;
    publicKey?: string;
  }) {
    return this.api.postJSON<{ id: string }>("/entity", e).then((r) => r.id);
  }
}
