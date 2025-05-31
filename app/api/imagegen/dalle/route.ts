import OpenAI from "openai";
import { NextResponse } from "next/server";
import { provenanceTracker } from "@/lib/provenance";

const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: API_KEY });

export const revalidate = 0;
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const requestbody = await request.json();
    const { input } = requestbody;

    console.log("Generating image with prompt:", input);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: input,
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data[0].url;

    // Track image generation in provenance
    const resourceId = provenanceTracker.generateResourceId(
      "resource",
      "generated-image"
    );
    provenanceTracker.addEntity({
      id: resourceId,
      type: "resource",
      metadata: {
        title: `Generated image: ${input.substring(0, 30)}...`,
        format: "image",
        prompt: input,
        createdAt: new Date().toISOString(),
        url: imageUrl,
      },
    });

    provenanceTracker.addActivity({
      id: provenanceTracker.generateActivityId("generate"),
      type: "generate",
      timestamp: new Date().toISOString(),
      performedBy: "tool:dalle",
      inputs: [],
      outputs: [resourceId],
      metadata: {
        prompt: input,
        model: "dall-e-3",
      },
    });

    return NextResponse.json(imageUrl, {
      status: 200,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
