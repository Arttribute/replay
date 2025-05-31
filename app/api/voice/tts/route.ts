import OpenAI from "openai";
import { NextResponse } from "next/server";
import { provenanceTracker } from "@/lib/provenance";

const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: API_KEY });

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const { input } = requestBody;

    const audioResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input,
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    // Create a temporary file URL for the audio
    // In a real implementation, you would store this in a temporary file storage
    // For now, we'll just track it in provenance without actual storage

    const resourceId = provenanceTracker.generateResourceId(
      "resource",
      "tts-audio"
    );

    provenanceTracker.addEntity({
      id: resourceId,
      type: "resource",
      metadata: {
        title: `TTS Audio: ${input.substring(0, 30)}...`,
        format: "audio/mpeg",
        text: input,
        createdAt: new Date().toISOString(),
        model: "tts-1",
        voice: "alloy",
      },
    });

    provenanceTracker.addActivity({
      id: provenanceTracker.generateActivityId("generate"),
      type: "generate",
      timestamp: new Date().toISOString(),
      performedBy: "tool:tts",
      inputs: [],
      outputs: [resourceId],
      metadata: {
        text: input,
        model: "tts-1",
        voice: "alloy",
      },
    });

    // Note: For audio files, we would need to implement a way to store the buffer
    // on Lighthouse, which would require additional handling.
    // This would typically involve:
    // 1. Saving the buffer to a temporary file
    // 2. Uploading that file to Lighthouse
    // 3. Updating the provenance with the permanent URL

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="speech.mp3"',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
