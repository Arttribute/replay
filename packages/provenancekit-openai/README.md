# @provenancekit/openai

> **One‑liner:** `new OpenAIWithProvenance({ apiKey }, { baseUrl })`

## Quick example

```ts
import { OpenAIWithProvenance } from "@provenancekit/openai";

const openai = new OpenAIWithProvenance(
  { apiKey: process.env.OPENAI_API_KEY! }, // ← passes straight to OpenAI
  { baseUrl: "http://localhost:3000" } // ← ProvenanceKit REST API
);

// 1️⃣  Image generation
const img = await openai.images.generateWithProvenance({
  model: "gpt-image-1",
  prompt: "A baby otter wearing VR goggles",
  size: "1024x1024",
});

console.log("Image CID:", img.provenance[0].cid);

// 2️⃣  Text‑to‑speech
const { response, provenance } = await openai.audio.speech.createWithProvenance(
  {
    model: "gpt-4o-mini-tts",
    voice: "nova",
    input: "Hello provenance!",
  }
);
console.log("Audio CID:", provenance.cid);
```
