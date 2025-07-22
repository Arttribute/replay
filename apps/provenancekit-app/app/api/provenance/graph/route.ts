// app/api/graph/[cid]/route.ts
import { NextResponse } from "next/server";
import { pk } from "@/lib/provenance";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json(
        { error: "Missing 'cid' parameter" },
        { status: 400 }
      );
    }
    const graph = await pk.graph(cid, 10);
    return NextResponse.json(graph);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
