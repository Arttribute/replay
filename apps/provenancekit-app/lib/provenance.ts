// lib/provenance.ts
import { ProvenanceKit } from "@provenancekit/sdk";
import { OpenAIWithProvenance } from "@provenancekit/openai";

const PROVENANCE_API = process.env.PROVENANCE_API_URL!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!PROVENANCE_API) throw new Error("Missing PROVENANCE_API_URL env");
if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY env");

export const pk = new ProvenanceKit({ baseUrl: PROVENANCE_API });

/**
 * For the demo we’ll just hardcode 3 entity ids.
 * (You can persist real ids in DB/user session.)
 */
export const DEMO_HUMAN_ID = "ent-human-demo";
export const DEMO_AI_ID = "ent-ai-openai";
export const DEMO_TOOL_ID = "ent-tool-generic";

export const openaiProv = new OpenAIWithProvenance(
  { apiKey: OPENAI_API_KEY },
  { client: pk }
);
