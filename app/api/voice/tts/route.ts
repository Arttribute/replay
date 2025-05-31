import OpenAI from "openai";
import { NextResponse } from "next/server";

const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: API_KEY });

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const { input } = requestBody;

    const audioResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input,
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="speech.mp3"',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
