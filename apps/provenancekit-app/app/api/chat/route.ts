// app/api/chat/route.ts
import { z } from "zod";
import { NextResponse } from "next/server";
import { openaiProv, pk } from "@/lib/provenance";

const BodySchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  messages: z.array(z.any()),
  model: z.string().default("gpt-4.1-mini"),
  inputCids: z.array(z.string()).default([]), // NEW
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model, sessionId, inputCids } = BodySchema.parse(body);

    const sid = sessionId ?? (await pk.createSession("Chat Demo"));

    const { completion, actions, finalOutputCids } =
      await openaiProv.chatWithProvenance(
        { model, messages },
        async () => {
          throw new Error("No tools in this demo");
        },
        {
          action: { inputCids }, // pass file inputs
          entity: { role: "human", name: "Demo User" },
        },
        { sessionId: sid }
      );

    return NextResponse.json({
      completion,
      actions,
      finalOutputCids,
      sessionId: sid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
