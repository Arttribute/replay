import { NextResponse } from "next/server";
import OpenAI from "openai";
import { agentStorage } from "@/lib/storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const agent = agentStorage.getById(agentId);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Delete OpenAI Assistant
    //if (agent.assistantId) {
    //  try {
    //    await openai.beta.assistants.del(agent.assistantId)
    //  } catch (error) {
    //    console.error("Error deleting OpenAI assistant:", error)
    //    // Continue with local deletion even if OpenAI deletion fails
    //  }
    //}

    // Remove from storage
    agentStorage.remove(agentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
