import { NextResponse } from "next/server";
import { provenanceStorage } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    let entities = provenanceStorage.getEntities();

    if (type) {
      entities = entities.filter((entity) => entity.type === type);
    }

    return NextResponse.json(entities);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const entity = await request.json();
    provenanceStorage.addEntity(entity);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
