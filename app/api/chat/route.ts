import { NextResponse } from "next/server";
import OpenAI from "openai";
import { provenanceTracker } from "@/lib/provenance";
import { agentStorage } from "@/lib/storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { threadId, agentId, message } = await request.json();

    const agent = agentStorage.getById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Add message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Start the run with streaming
          const runStream = openai.beta.threads.runs.stream(threadId, {
            assistant_id: agent.assistantId || "",
          });

          for await (const event of runStream) {
            if (event.event === "thread.message.delta") {
              const delta = event.data.delta;
              if (
                delta.content &&
                delta.content[0] &&
                delta.content[0].type === "text" &&
                delta.content[0].text &&
                delta.content[0].text.value
              ) {
                const content = delta.content[0].text.value;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "content",
                      content,
                    })}\n\n`
                  )
                );
              }
            } else if (event.event === "thread.run.requires_action") {
              const toolCalls =
                event.data.required_action?.submit_tool_outputs?.tool_calls;

              if (toolCalls) {
                const toolOutputs = [];

                for (const toolCall of toolCalls) {
                  // Send tool call info to client
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_call",
                        toolCall: {
                          id: toolCall.id,
                          function: toolCall.function,
                        },
                      })}\n\n`
                    )
                  );

                  // Execute the tool
                  const result = await executeToolCall(toolCall, agent);

                  // Send tool result to client
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_result",
                        toolCallId: toolCall.id,
                        result,
                      })}\n\n`
                    )
                  );

                  toolOutputs.push({
                    tool_call_id: toolCall.id,
                    output:
                      typeof result === "string"
                        ? result
                        : JSON.stringify(result),
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
                      format: "json",
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
                }

                // Submit tool outputs
                //await openai.beta.threads.runs.submitToolOutputs(threadId, event.data.id, {
                //  tool_outputs: toolOutputs,
                //})
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function executeToolCall(toolCall: any, agent: any) {
  const tool = agent.tools.find((t: any) => t.id === toolCall.function.name);
  if (!tool) {
    throw new Error(`Tool ${toolCall.function.name} not found`);
  }

  const args = JSON.parse(toolCall.function.arguments);

  try {
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
    return result;
  } catch (error) {
    console.error(`Error executing tool ${toolCall.function.name}:`, error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
