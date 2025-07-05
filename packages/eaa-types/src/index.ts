import { z } from "zod";

/*─────────────────────────────────────*\
 | 0.  Global constants & helpers       |
\*─────────────────────────────────────*/

export const CONTEXT_URI = "https://replayprotocol.org/context/v1" as const;

/**  ext:namespace[:sub…]@semver  */
const extensionKeyRegex = /^ext:[a-zA-Z]\w*(?::\w+)*@\d+\.\d+\.\d+$/;

/**  ext:namespace[:sub…]           */
const extensionNamespaceRegex = /^ext:[a-zA-Z]\w*(?::\w+)*$/;

/** z.enum() helper for readonly string tuples */
const makeEnum = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.enum(vals);

/*─────────────────────────────────────*\
 | 1.  Core enum literals               |
\*─────────────────────────────────────*/

export const EntityRoleCore = ["human", "ai", "organization"] as const;

export const ActionTypeCore = [
  "create",
  "remix",
  "train",
  "review",
  "assign",
  "aggregate",
  "contribute",
] as const;

export const AttributionRoleCore = [
  "creator",
  "contributor",
  "sourceMaterial",
  "reviewer",
] as const;

export const ResourceTypeCore = [
  "text",
  "image",
  "video",
  "audio",
  "code",
  "dataset",
  "model",
  "tool",
  "composite",
] as const;

/*─────────────────────────────────────*\
 | 2.  Extensible enum unions           |
\*─────────────────────────────────────*/

const makeExtensibleEnum = <T extends z.ZodEnum<any>>(core: T) =>
  z.union([
    core,
    z.string().regex(extensionNamespaceRegex, {
      message: "Custom value must be namespaced: ext:namespace[:sub]",
    }),
  ]);

export const EntityRole = makeExtensibleEnum(makeEnum(EntityRoleCore));
export type EntityRole = z.infer<typeof EntityRole>;

export const ActionType = makeExtensibleEnum(makeEnum(ActionTypeCore));
export type ActionType = z.infer<typeof ActionType>;

export const AttributionRole = makeExtensibleEnum(
  makeEnum(AttributionRoleCore)
);
export type AttributionRole = z.infer<typeof AttributionRole>;

export const ResourceType = makeExtensibleEnum(makeEnum(ResourceTypeCore));
export type ResourceType = z.infer<typeof ResourceType>;

/*─────────────────────────────────────*\
 | 3.  Immutable, versioned extensions  |
\*─────────────────────────────────────*/

/** Single extension definition (schema is *immutable once shipped*) */
export interface ExtensionDefinition {
  readonly key: string; // ext:namespace@1.0.0 or ext:ns:sub@0.1.0
  readonly tag:
    | "EntityRole"
    | "ActionType"
    | "AttributionRole"
    | "ResourceType";
  readonly schema: z.ZodSchema; // shape of extension payload
  readonly description?: string;
}

/** Create a registry from a frozen list of definitions */
export class ExtensionRegistry {
  private readonly map: ReadonlyMap<string, ExtensionDefinition>;

  private constructor(defs: ExtensionDefinition[]) {
    const m = new Map<string, ExtensionDefinition>();
    for (const d of defs) {
      if (!extensionKeyRegex.test(d.key))
        throw new Error(`Invalid extension key: ${d.key}`);
      if (m.has(d.key)) throw new Error(`Duplicate extension key: ${d.key}`);
      m.set(d.key, d);
    }
    this.map = m;
  }

  /** Factory – usually called at build/init time */
  static create(defs: ExtensionDefinition[] = []) {
    return new ExtensionRegistry(defs);
  }

  /** Pure “add” – returns a BRAND-NEW registry */
  with(def: ExtensionDefinition): ExtensionRegistry {
    return ExtensionRegistry.create([...this.map.values(), def]);
  }

  /** Lookup by exact key (`ext:foo@1.2.0`) */
  get(key: string): ExtensionDefinition | undefined {
    return this.map.get(key);
  }

  /** Validate extension payload */
  validate(key: string, value: unknown): boolean {
    const def = this.map.get(key);
    return !!def && def.schema.safeParse(value).success;
  }

  /** Latest version for a namespace */
  latest(namespace: string): ExtensionDefinition | undefined {
    const ns = namespace.startsWith("ext:") ? namespace : `ext:${namespace}`;
    const defs = [...this.map.values()].filter((d) =>
      d.key.startsWith(`${ns}@`)
    );
    return defs.sort((a, b) =>
      b.key.localeCompare(a.key, undefined, { numeric: true })
    )[0];
  }

  /** All keys for a tag */
  keys(tag: ExtensionDefinition["tag"]) {
    return [...this.map.values()]
      .filter((d) => d.tag === tag)
      .map((d) => d.key);
  }
}

/*─────────────────────────────────────*\
 | 4.  Content-address schema helpers    |
\*─────────────────────────────────────*/

/** CID v0 / v1 – simple check */
const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[1-9A-HJ-NP-Za-km-z]{56,})$/;

/** Minimal content address object */
export const ContentAddress = z.object({
  cid: z.string().regex(cidRegex, { message: "Invalid CID" }),
  size: z.number().int().min(0),
  algorithm: z.enum(["sha256"]).default("sha256"),
});
export type ContentAddress = z.infer<typeof ContentAddress>;

/*─────────────────────────────────────*\
 | 5.  Primary EAA data schemas          |
\*─────────────────────────────────────*/

export const Entity = z.object({
  id: z.string(), // DID or 0x address
  name: z.string().optional(),
  role: EntityRole,
  publicKey: z.string().optional(),
  wallet: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  extensions: z.record(z.any()).optional(),
});
export type Entity = z.infer<typeof Entity>;

export const Resource = z.object({
  address: ContentAddress, // content-addressed primary key
  type: ResourceType,
  /** At least one resolvable location (ipfs://, https://, s3://…) */
  locations: z
    .array(
      z.object({
        uri: z.string().url(),
        provider: z.string(),
        verified: z.boolean().default(false),
      })
    )
    .min(1),
  createdAt: z.string(),
  createdBy: z.string(),
  rootAction: z.string(),
  license: z.string().optional(),
  extensions: z.record(z.any()).optional(),
});
export type Resource = z.infer<typeof Resource>;

export const Action = z.object({
  id: z.string(), // could be CID or tx hash
  type: ActionType,
  performedBy: z.string(),
  timestamp: z.string(),
  inputCids: z.array(z.string().regex(cidRegex)),
  outputCids: z.array(z.string().regex(cidRegex)),
  assignedByEntity: z.string().optional(),
  reviewedByEntity: z.string().optional(),
  reviewOutcome: z
    .enum(["approved", "rejected", "suggestedChanges"])
    .optional(),
  toolUsed: z.string().optional(),
  proof: z.string().optional(), // sig / tx
  extensions: z.record(z.any()).optional(),
});
export type Action = z.infer<typeof Action>;

export const Attribution = z.object({
  resourceCid: z.string().regex(cidRegex),
  entityId: z.string(),
  role: AttributionRole,
  weight: z.number().int().min(0).max(10_000).optional(),
  includedInRevenue: z.boolean().default(false),
  includedInAttribution: z.boolean().default(true),
  note: z.string().optional(),
  extensions: z.record(z.any()).optional(),
});
export type Attribution = z.infer<typeof Attribution>;

export const ProvenanceBundle = z.object({
  context: z.literal(CONTEXT_URI),
  entities: z.array(Entity).default([]),
  resources: z.array(Resource).default([]),
  actions: z.array(Action).default([]),
  attributions: z.array(Attribution).default([]),
  extensions: z.record(z.any()).optional(),
});
export type ProvenanceBundle = z.infer<typeof ProvenanceBundle>;
