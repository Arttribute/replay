import { NextResponse } from "next/server";
import { provenanceTracker } from "@/lib/provenance";

export async function GET() {
  try {
    const activities = provenanceTracker.getActivities();
    return NextResponse.json(activities);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const activity = await request.json();
    provenanceTracker.addActivity(activity);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
