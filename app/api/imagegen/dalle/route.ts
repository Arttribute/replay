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

    const imageUrl = response?.data?.[0]?.url;

    // Create a resource ID for tracking
    const resourceId = provenanceTracker.generateResourceId(
      "resource",
      "generated-image"
    );

    // Track initial image generation in provenance
    provenanceTracker.addEntity({
      id: resourceId,
      type: "resource",
      metadata: {
        title: `Generated image: ${input.substring(0, 30)}...`,
        format: "image",
        prompt: input,
        createdAt: new Date().toISOString(),
        url: imageUrl,
        temporary: true, // Mark as temporary since it's not stored permanently yet
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

    // Store the image on Lighthouse automatically
    try {
      const lighthouseResponse = await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/api/storage/lighthouse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: imageUrl,
            resourceName: `DALL-E: ${input.substring(0, 30)}...`,
            resourceType: "image",
            resourceId: resourceId, // Pass the existing resource ID to update it
          }),
        }
      );

      if (lighthouseResponse.ok) {
        const lighthouseData = await lighthouseResponse.json();
        console.log("Image stored on Lighthouse:", lighthouseData);

        // Return the permanent URL from Lighthouse
        return NextResponse.json(lighthouseData.gatewayUrl, {
          status: 200,
        });
      } else {
        console.error(
          "Failed to store image on Lighthouse, using original URL"
        );
      }
    } catch (error) {
      console.error("Error storing image on Lighthouse:", error);
      // Continue with the original URL if Lighthouse storage fails
    }

    // Return the original URL if Lighthouse storage fails
    return NextResponse.json(imageUrl, {
      status: 200,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
