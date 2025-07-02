import { z } from "zod";

export const CONTEXT_URI = "https://replayprotocol.org/context/v1" as const;

/** `ext:namespace[:sub[:sub…]]`  (letters/nums/underscore only) */
const extensionRegex = /^ext:[a-zA-Z]\w*(?::\w+)*$/;

/** z.enum() wants a non-empty tuple, not a readonly string[] */
const makeEnum = <A extends readonly [string, ...string[]]>(a: A) => z.enum(a);

export const EntityRoleCore = ["human", "ai", "organization"] as const;

export const ActionTypeCore = [
  "create",
  "derive",
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

export const EntityRole = z.union([
  makeEnum(EntityRoleCore),
  z.string().regex(extensionRegex, {
    message: "Extension must follow: ext:namespace or ext:namespace:sub",
  }),
]);
export type EntityRole = z.infer<typeof EntityRole>;

export const ActionType = z.union([
  makeEnum(ActionTypeCore),
  z.string().regex(extensionRegex, { message: "Invalid extension" }),
]);
export type ActionType = z.infer<typeof ActionType>;

export const AttributionRole = z.union([
  makeEnum(AttributionRoleCore),
  z.string().regex(extensionRegex, { message: "Invalid extension" }),
]);
export type AttributionRole = z.infer<typeof AttributionRole>;

export const ResourceType = z.union([
  makeEnum(ResourceTypeCore),
  z.string().regex(extensionRegex, { message: "Invalid extension" }),
]);
export type ResourceType = z.infer<typeof ResourceType>;

/*───────────────────────────•
 |  3.  Enum utility helpers  |
 •───────────────────────────*/

export const enumUtils = {
  /* Core checks (type-guard friendly) */
  isCore: {
    entityRole: (v: string): v is (typeof EntityRoleCore)[number] =>
      (EntityRoleCore as readonly string[]).includes(v),
    actionType: (v: string): v is (typeof ActionTypeCore)[number] =>
      (ActionTypeCore as readonly string[]).includes(v),
    attributionRole: (v: string): v is (typeof AttributionRoleCore)[number] =>
      (AttributionRoleCore as readonly string[]).includes(v),
    resourceType: (v: string): v is (typeof ResourceTypeCore)[number] =>
      (ResourceTypeCore as readonly string[]).includes(v),
  },

  /* Is the value namespaced? */
  isExtended: (val: string) => val.startsWith("ext:"),

  /* Parse `ext:ns:foo:bar` → { namespace:'ns', path:'foo:bar' } */
  parseExtended: (val: string): { namespace: string; path?: string } | null => {
    if (!extensionRegex.test(val)) return null;
    const [, ...parts] = val.split(":"); // drop 'ext'
    return {
      namespace: parts[0],
      path: parts.slice(1).join(":") || undefined,
    };
  },
};

/*───────────────────────────•
 |  4.  Runtime registry      |
 •───────────────────────────*/

type EnumTag = "EntityRole" | "ActionType" | "AttributionRole" | "ResourceType";

/**
 * Keeps a list of well-known extensions so tooling can
 * surface suggestions & warn on typos. Not enforced by Zod.
 */
export class ExtensionRegistry {
  private static store = new Map<EnumTag, Set<string>>();

  static register(tag: EnumTag, extName: string) {
    const key = `ext:${extName}`;
    if (!extensionRegex.test(key))
      throw new Error(`Invalid extension: ${extName}`);

    if (!this.store.has(tag)) this.store.set(tag, new Set());
    this.store.get(tag)!.add(key);
  }

  static get(tag: EnumTag): string[] {
    return [...(this.store.get(tag) ?? [])];
  }

  static has(tag: EnumTag, val: string): boolean {
    return this.store.get(tag)?.has(val) ?? false;
  }

  static allValid(tag: EnumTag, core: readonly string[]): string[] {
    return [...core, ...this.get(tag)];
  }
}

/*───────────────────────────•
 |  5.  Primary data schemas  |
 •───────────────────────────*/

export const Entity = z.object({
  id: z.string(), // DID or 0x
  name: z.string().optional(),
  role: EntityRole,
  publicKey: z.string().optional(),
  wallet: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  extensions: z.record(z.any()).optional(),
});
export type Entity = z.infer<typeof Entity>;

export const Resource = z.object({
  id: z.string(),
  type: ResourceType,
  uri: z.string(),
  createdAt: z.string(), // ISO 8601
  createdBy: z.string(), // entityId
  rootAction: z.string(), // actionId
  contentHash: z.string().optional(),
  license: z.string().optional(),
  extensions: z.record(z.any()).optional(),
});
export type Resource = z.infer<typeof Resource>;

export const Action = z.object({
  id: z.string(),
  type: ActionType,
  performedBy: z.string(),
  timestamp: z.string(),
  inputResources: z.array(z.string()),
  outputResources: z.array(z.string()),
  assignedByEntity: z.string().optional(),
  reviewedByEntity: z.string().optional(),
  reviewOutcome: z
    .enum(["approved", "rejected", "suggestedChanges"])
    .optional(),
  toolUsed: z.string().optional(),
  proof: z.string().optional(),
  extensions: z.record(z.any()).optional(),
});
export type Action = z.infer<typeof Action>;

export const Attribution = z.object({
  resourceId: z.string(),
  entityId: z.string(),
  role: AttributionRole,
  weight: z.number().int().min(0).max(10000).optional(), // 0 or undefined = unspecified
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
