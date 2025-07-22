// app/api/image/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiProv } from "@/lib/provenance";

const BodySchema = z.object({
  prompt: z.string(),
  model: z.string().default("dall-e-3"),
  size: z.string().default("1024x1024"),
  n: z.number().default(1),
});

export async function POST(req: Request) {
  try {
    const { prompt, model, size, n } = BodySchema.parse(await req.json());

    const out = await openaiProv.generateImageWithProvenance(
      { model, prompt, n, size },
      { entity: { role: "ai" } }
    );

    // Return urls/base64 from OpenAI plus provenance
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
