// app/api/attachments/route.ts
import { NextResponse } from "next/server";
import { pk } from "@/lib/provenance";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const sessionIdRaw = form.get("sessionId")?.toString();
    const sessionId =
      sessionIdRaw && sessionIdRaw.length ? sessionIdRaw : undefined;
    const claimed = form.get("claimed") === "true";
    const files = form.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const results: Array<{
      name: string;
      cid: string;
      matched?: { cid: string; score: number };
      duplicate?: any;
      size: number;
      type: string;
    }> = [];

    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const type = inferResourceType(f.type);

      // 1) Try vector/hash match
      const matchRes = await pk.uploadAndMatch(bytes, {
        type,
        topK: 1,
        min: 0.8,
      });

      if (matchRes.verdict === "auto" && matchRes.matches[0].score >= 0.95) {
        results.push({
          name: f.name,
          cid: matchRes.matches[0].cid,
          matched: matchRes.matches[0],
          size: f.size,
          type: f.type,
        });
        continue;
      }

      // 2) Store new
      const stored = await pk.file(bytes, {
        entity: claimed
          ? { role: "human", name: "Demo User" }
          : { role: "unclaimed" },
        action: { type: "upload" }, // << important
        resourceType: type,
        sessionId,
      });

      results.push({
        name: f.name,
        cid: stored.cid,
        duplicate: stored.duplicate,
        size: f.size,
        type: f.type,
      });
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    // Log full server response if available
    return NextResponse.json(
      { error: e.message || "Unknown error" },
      { status: 500 }
    );
  }
}

function inferResourceType(m: string): string {
  if (!m) return "unknown";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("text/") || m === "application/pdf") return "text";
  return "binary";
}
