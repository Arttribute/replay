import { ProvenanceKit } from "@provenancekit/sdk";
import { OpenAIWithProvenance } from "@provenancekit/openai";

const PROVENANCE_API = process.env.PROVENANCE_API_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!PROVENANCE_API) throw new Error("Missing PROVENANCE_API_URL env");
if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY env");

export const pk = new ProvenanceKit({
  baseUrl: PROVENANCE_API,
});

export const openaiProv = new OpenAIWithProvenance(
  { apiKey: OPENAI_API_KEY },
  { client: pk }
);
