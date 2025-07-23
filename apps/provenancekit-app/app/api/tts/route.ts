// app/api/tts/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiProv, DEMO_HUMAN_ID, DEMO_AI_ID } from "@/lib/provenance";

const BodySchema = z.object({
  text: z.string(),
  model: z.string().default("tts-1"),
  voice: z.string().default("alloy"),
  format: z.string().default("mp3"),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const { text, model, voice, format, sessionId } = BodySchema.parse(
      await req.json()
    );

    const { response, provenance } = await openaiProv.ttsWithProvenance(
      { model, voice, input: text },
      { entity: { role: "ai" } },
      { sessionId, humanEntityId: DEMO_HUMAN_ID, aiEntityId: DEMO_AI_ID }
    );

    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": `audio/${format}`,
        "Content-Disposition": `inline; filename="speech.${format}"`,
        ...(provenance && "cid" in provenance
          ? { "X-Provenance-CID": provenance.cid }
          : {}),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
