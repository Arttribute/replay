import { NextResponse } from "next/server";
import { provenanceStorage } from "@/lib/storage";

export async function GET() {
  try {
    const activities = provenanceStorage.getActivities();
    return NextResponse.json(activities);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const activity = await request.json();
    provenanceStorage.addActivity(activity);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
