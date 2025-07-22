// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiProv } from "@/lib/provenance";

export const revalidate = 0;
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.string(),
      name: z.string().optional(),
      tool_call_id: z.string().optional(),
    })
  ),
  model: z.string().default("gpt-4.1-mini"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model } = BodySchema.parse(body);

    const { completion, actions, finalOutputCids } =
      await openaiProv.chatWithProvenance(
        { model, messages },
        async () => {
          throw new Error("No tools in this demo");
        },
        {
          entity: { role: "human" },
        }
      );

    return NextResponse.json({ completion, actions, finalOutputCids });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
