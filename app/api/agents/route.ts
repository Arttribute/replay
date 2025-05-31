import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { Agent, Tool } from "@/types/agent";
import { provenanceTracker } from "@/lib/provenance";
import { agentStorage } from "@/lib/storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const agents = agentStorage.getAll();
    return NextResponse.json(agents);
  } catch (error: any) {
    console.error("Error getting agents:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

    console.log("Creating agent with tools:", tools);

    // Create OpenAI Assistant with proper tool formatting
    const assistantTools = tools.map((tool: Tool) => ({
      type: "function" as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    console.log("Creating OpenAI assistant with tools:", assistantTools);

    const assistant = await openai.beta.assistants.create({
      name,
      instructions,
      model: "gpt-4o",
      tools: assistantTools,
    });

    console.log("OpenAI assistant created:", assistant.id);

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
    console.log("Agent stored:", agent.id);

    // Verify agent was stored
    const storedAgent = agentStorage.getById(agent.id);
    console.log("Agent verification:", storedAgent ? "Found" : "Not found");

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
