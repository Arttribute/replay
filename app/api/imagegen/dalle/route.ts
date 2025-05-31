import OpenAI from "openai";
import { NextResponse } from "next/server";

const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: API_KEY });

export const revalidate = 0;
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const requestbody = await request.json();
    const { input } = requestbody;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: input,
      n: 1,
      size: "1024x1024",
    });

    if (response.data && response.data[0] && response.data[0].url) {
      return new NextResponse(JSON.stringify(response.data[0].url), {
        status: 200,
      });
    } else {
      throw new Error("Invalid response data");
    }
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
