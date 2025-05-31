import { NextResponse } from "next/server";
import OpenAI from "openai";
import { chatStorage } from "@/lib/storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { agentId, existingThreadId } = await request.json();

    // If an existing thread ID is provided, try to load it
    if (existingThreadId) {
      const existingThread = chatStorage.getThread(existingThreadId);
      if (existingThread) {
        return NextResponse.json({
          threadId: existingThreadId,
          messages: existingThread.messages,
        });
      }
    }

    // Create a new OpenAI thread
    const thread = await openai.beta.threads.create();

    // Store the thread in our system
    chatStorage.createThread(agentId, thread.id);

    return NextResponse.json({
      threadId: thread.id,
      messages: [],
    });
  } catch (error: any) {
    console.error("Error creating thread:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (agentId) {
      const threads = chatStorage.getThreadsByAgentId(agentId);
      return NextResponse.json(threads);
    } else {
      const allThreads = chatStorage.getAllThreads();
      return NextResponse.json(allThreads);
    }
  } catch (error: any) {
    console.error("Error getting threads:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
