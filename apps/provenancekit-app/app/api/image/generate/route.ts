// app/api/image/generate/route.ts
// app/api/image/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiProv, DEMO_HUMAN_ID, DEMO_AI_ID } from "@/lib/provenance";

export const revalidate = 0;

const BodySchema = z.object({
  prompt: z.string(),
  model: z.string().default("dall-e-3"),
  size: z
    .enum([
      "1024x1024",
      "auto",
      "1536x1024",
      "1024x1536",
      "256x256",
      "512x512",
      "1792x1024",
      "1024x1792",
    ])
    .default("1024x1024"),
  n: z.number().default(1),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const { prompt, model, size, n, sessionId } = BodySchema.parse(
      await req.json()
    );

    const out = await openaiProv.generateImageWithProvenance(
      { model, prompt, n, size },
      {
        entity: {
          id: "6339682a-7f3d-4fae-a086-e959bfda6a85",
          role: "human",
          name: "Alice",
        },
        action: { type: "ext:generate_image" },
      }
      //{ sessionId, humanEntityId: DEMO_HUMAN_ID, aiEntityId: DEMO_AI_ID }
    );

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
