// lib/provenance.ts
import { ProvenanceKit } from "@provenancekit/sdk";
import { OpenAIWithProvenance } from "@provenancekit/openai";

const provBaseUrl = process.env.PROVENANCE_API!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!provBaseUrl) throw new Error("Missing PROVENANCE_API env");
if (!openaiKey) throw new Error("Missing OPENAI_API_KEY env");

export const pk = new ProvenanceKit({ baseUrl: provBaseUrl });

export const openaiProv = new OpenAIWithProvenance(
  { apiKey: openaiKey },
  { client: pk }
);
