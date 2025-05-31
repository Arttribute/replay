import { NextResponse } from "next/server";
import { provenanceTracker } from "@/lib/provenance";

export async function GET() {
  try {
    const attributions = provenanceTracker.getAttributions();
    return NextResponse.json(attributions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const attribution = await request.json();
    provenanceTracker.addAttribution(attribution);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
