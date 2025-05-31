import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { Agent, Tool } from "@/types/agent";
import { provenanceTracker } from "@/lib/provenance";
import { agentStorage } from "@/lib/storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  return NextResponse.json(agentStorage.getAll());
}

export async function POST(request: Request) {
  try {
    const { name, instructions, tools } = await request.json();

    if (!name || !instructions) {
      return NextResponse.json(
        { error: "Name and instructions are required" },
        { status: 400 }
      );
    }

    // Create OpenAI Assistant with proper tool formatting
    const assistantTools = tools.map((tool: Tool) => ({
      type: "function" as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const assistant = await openai.beta.assistants.create({
      name,
      instructions,
      model: "gpt-4o",
      tools: assistantTools,
    });

    const agent: Agent = {
      id: `agent:${Date.now()}`,
      name,
      instructions,
      tools,
      assistantId: assistant.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    agentStorage.add(agent);

    // Track agent creation in provenance
    provenanceTracker.addEntity({
      id: agent.id,
      type: "ai",
      metadata: {
        name: agent.name,
        instructions: agent.instructions,
        assistantId: agent.assistantId,
        toolCount: agent.tools.length,
      },
    });

    provenanceTracker.addActivity({
      id: provenanceTracker.generateActivityId("generate"),
      type: "generate",
      timestamp: new Date().toISOString(),
      performedBy: "human:system",
      inputs: [],
      outputs: [agent.id],
      metadata: {
        task: "Create AI agent",
        agentName: agent.name,
      },
    });

    return NextResponse.json(agent);
  } catch (error: any) {
    console.error("Error creating agent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
