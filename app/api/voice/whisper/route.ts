import OpenAI from "openai";
import { NextResponse } from "next/server";

const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: API_KEY });

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const { base64Audio } = requestBody;

    const buffer = Buffer.from(base64Audio, "base64");
    const file = new File([buffer], "audio.wav", { type: "audio/wav" });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    return new NextResponse(
      JSON.stringify({ transcription: transcription.text }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
