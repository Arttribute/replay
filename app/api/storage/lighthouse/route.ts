import { NextResponse } from "next/server";
import { getApiKey, uploadFromUrl } from "@/lib/lighthouse";
import { provenanceTracker } from "@/lib/provenance";

// Environment variables for Lighthouse
const LIGHTHOUSE_PUBLIC_KEY = process.env.LIGHTHOUSE_PUBLIC_KEY;
const LIGHTHOUSE_PRIVATE_KEY = process.env.LIGHTHOUSE_PRIVATE_KEY;
const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

export async function POST(request: Request) {
  try {
    const { url, resourceName, resourceType, resourceId } =
      await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Get API key - either use the one from env or generate a new one
    let apiKey = LIGHTHOUSE_API_KEY;

    if (!apiKey && LIGHTHOUSE_PUBLIC_KEY && LIGHTHOUSE_PRIVATE_KEY) {
      try {
        const keyResponse = await getApiKey(
          LIGHTHOUSE_PUBLIC_KEY,
          LIGHTHOUSE_PRIVATE_KEY
        );
        apiKey = keyResponse.data.apiKey;
      } catch (error) {
        console.error("Failed to get Lighthouse API key:", error);
        return NextResponse.json(
          { error: "Failed to get Lighthouse API key" },
          { status: 500 }
        );
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Lighthouse API key not available" },
        { status: 500 }
      );
    }

    // Upload the file to Lighthouse
    const uploadResponse = await uploadFromUrl(url, apiKey);

    if (!uploadResponse || !uploadResponse.data || !uploadResponse.data.Hash) {
      return NextResponse.json(
        { error: "Failed to upload to Lighthouse" },
        { status: 500 }
      );
    }

    const { Hash: cid, Name: name, Size: size } = uploadResponse.data;
    const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${cid}`;

    // Track the resource in provenance if resourceId is not provided
    // If resourceId is provided, update the existing resource
    const finalResourceId =
      resourceId ||
      provenanceTracker.generateResourceId("resource", resourceName || name);

    provenanceTracker.addEntity({
      id: finalResourceId,
      type: "resource",
      metadata: {
        title: resourceName || name,
        format: resourceType || name.split(".").pop() || "unknown",
        size: Number.parseInt(size),
        createdAt: new Date().toISOString(),
        url: gatewayUrl,
        cid,
        storage: "lighthouse",
      },
    });

    // Only add activity if this is a new resource
    if (!resourceId) {
      provenanceTracker.addActivity({
        id: provenanceTracker.generateActivityId("generate"),
        type: "generate",
        timestamp: new Date().toISOString(),
        performedBy: "tool:lighthouse",
        inputs: [url],
        outputs: [finalResourceId],
        metadata: {
          task: "Store resource on Lighthouse",
          storage: "lighthouse",
          cid,
        },
      });
    }

    return NextResponse.json({
      success: true,
      resourceId: finalResourceId,
      cid,
      name,
      size,
      gatewayUrl,
    });
  } catch (error: any) {
    console.error("Error in Lighthouse storage API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
