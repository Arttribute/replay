// app/api/image/edit/route.ts
import { NextResponse } from "next/server";
import { openaiProv } from "@/lib/provenance";

export const runtime = "nodejs"; // ensure File is available

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const prompt = form.get("prompt")?.toString() ?? "";
    const image = form.get("image");
    const mask = form.get("mask"); // optional

    if (!(image instanceof File))
      return NextResponse.json(
        { error: "`image` file required" },
        { status: 400 }
      );

    const params: any = {
      model: "dall-e-3",
      prompt,
      image,
    };
    if (mask instanceof File) params.mask = mask;

    const result = await openaiProv.editImageWithProvenance(params, {
      entity: { role: "ai" },
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
