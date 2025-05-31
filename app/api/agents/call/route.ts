import { NextResponse } from "next/server";
import OpenAI from "openai";
import { agentStorage } from "@/lib/storage";
import { provenanceTracker } from "@/lib/provenance";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { agentId, instruction, inputs } = await request.json();

    // Find the agent
    const agent = agentStorage.getById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (!agent.assistantId) {
      return NextResponse.json(
        { error: "Agent has no associated OpenAI assistant" },
        { status: 400 }
      );
    }

    // Create a temporary thread for this interaction
    const thread = await openai.beta.threads.create();

    // Add the message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `${instruction}\n\nInput: ${inputs}`,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: agent.assistantId,
    });
    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    // Poll until the run is completed or fails
    while (
      runStatus.status === "queued" ||
      runStatus.status === "in_progress" ||
      runStatus.status === "requires_action"
    ) {
      // If the run requires action (tool calls), handle them
      if (runStatus.status === "requires_action") {
        const toolCalls =
          runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
        const toolOutputs = [];

        for (const toolCall of toolCalls) {
          // Find the tool
          const tool = agent.tools.find((t) => t.id === toolCall.function.name);
          if (!tool) {
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify({
                error: `Tool ${toolCall.function.name} not found`,
              }),
            });
            continue;
          }

          // Execute the tool
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${
                tool.endpoint
              }`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args),
              }
            );

            if (!response.ok) {
              throw new Error(`Tool execution failed: ${response.statusText}`);
            }

            const result = await response.json();
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output:
                typeof result === "string" ? result : JSON.stringify(result),
            });

            // Track tool usage in provenance
            const resourceId = provenanceTracker.generateResourceId(
              "resource",
              "tool-output"
            );
            provenanceTracker.addEntity({
              id: resourceId,
              type: "resource",
              metadata: {
                title: `${toolCall.function.name} output`,
                format:
                  toolCall.function.name === "image_generation"
                    ? "image"
                    : "json",
                toolUsed: toolCall.function.name,
                createdAt: new Date().toISOString(),
              },
            });

            provenanceTracker.addActivity({
              id: provenanceTracker.generateActivityId("generate"),
              type: "generate",
              timestamp: new Date().toISOString(),
              performedBy: agentId,
              inputs: [],
              outputs: [resourceId],
              metadata: {
                toolUsed: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            });
          } catch (error) {
            console.error(
              `Error executing tool ${toolCall.function.name}:`,
              error
            );
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify({
                error: `Error: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              }),
            });
          }
        }
        // Submit tool outputs
        await openai.beta.threads.runs.submitToolOutputs(run.id, {
          tool_outputs: toolOutputs,
          thread_id: thread.id,
        });
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve({
        thread_id: thread.id,
        run_id: run.id,
      });
    }

    if (runStatus.status === "completed") {
      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessages = messages.data.filter(
        (msg) => msg.role === "assistant"
      );

      // Get the latest assistant message
      const latestMessage = assistantMessages[0];

      if (latestMessage && latestMessage.content) {
        let responseText = "";

        for (const content of latestMessage.content) {
          if (content.type === "text") {
            responseText += content.text.value;
          }
        }

        // Track the agent interaction in provenance
        const resourceId = provenanceTracker.generateResourceId(
          "resource",
          "agent-response"
        );
        provenanceTracker.addEntity({
          id: resourceId,
          type: "resource",
          metadata: {
            title: `Response from ${agent.name}`,
            format: "text",
            createdAt: new Date().toISOString(),
          },
        });

        provenanceTracker.addActivity({
          id: provenanceTracker.generateActivityId("generate"),
          type: "generate",
          timestamp: new Date().toISOString(),
          performedBy: agentId,
          inputs: [],
          outputs: [resourceId],
          metadata: {
            task: instruction,
            input: inputs,
          },
        });

        return NextResponse.json(responseText);
      }
    }

    return NextResponse.json(
      { error: `Run failed with status: ${runStatus.status}` },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("Error calling agent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
