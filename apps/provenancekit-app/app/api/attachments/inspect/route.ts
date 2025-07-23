// app/api/attachments/inspect/route.ts
import { NextResponse } from "next/server";
import { pk } from "@/lib/provenance";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

type MatchRow = { cid: string; type: string; score: number };
type MatchObj = { verdict: string; matches: MatchRow[] };

function isMatchObj(x: any): x is MatchObj {
  return x && Array.isArray(x.matches);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const files: File[] = [];
    for (const [key, val] of form.entries()) {
      if ((key === "file" || key === "files") && val instanceof File) {
        files.push(val);
      }
    }
    if (!files.length) {
      return NextResponse.json(
        { error: "No file(s) provided" },
        { status: 400 }
      );
    }

    const topK = Number(form.get("topK") ?? 1);
    const minScore = Number(form.get("minScore") ?? 0.95);

    const results = await Promise.all(
      files.map(async (file) => {
        const rType = inferResourceType(file.type);

        // uploadAndMatch can take a File directly
        const matched = await pk.uploadAndMatch(file, {
          topK,
          min: 0.8,
          type: rType,
        });

        const rows: MatchRow[] = isMatchObj(matched)
          ? matched.matches
          : Array.isArray(matched)
          ? matched
          : [];

        const best = rows[0];
        if (best && best.score >= minScore) {
          const graph = await pk.graph(best.cid, 2);
          return {
            status: "match" as const,
            name: file.name,
            size: file.size,
            mime: file.type,
            type: rType,
            cid: best.cid,
            score: best.score,
            graph,
          };
        }

        return {
          status: "new" as const,
          name: file.name,
          size: file.size,
          mime: file.type,
          type: rType,
          cid: null,
          score: null,
          graph: null,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "inspect failed" },
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
