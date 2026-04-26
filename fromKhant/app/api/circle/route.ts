import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  const { imageUrl, x, y, topic, narration } = (await req.json()) as {
    imageUrl: string;
    x: number;
    y: number;
    topic: string;
    narration: string;
  };

  // Read image from public folder or fetch from URL
  let imageBase64: string;
  let mimeType: string;

  if (imageUrl.startsWith("/")) {
    // Local file in public/
    const filePath = path.join(process.cwd(), "public", imageUrl);
    const buffer = fs.readFileSync(filePath);
    imageBase64 = buffer.toString("base64");
    mimeType = imageUrl.endsWith(".png") ? "image/png" : "image/jpeg";
  } else {
    // Remote URL
    const res = await fetch(imageUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    imageBase64 = buffer.toString("base64");
    mimeType = res.headers.get("content-type") ?? "image/jpeg";
  }

  const prompt = `A child aged 6-12 is reading an educational story about "${topic}".

They are currently on this part of the story:
"${narration}"

They pointed at approximately (${Math.round(x)}%, ${Math.round(y)}%) of this illustration — that's ${x < 33 ? "the left side" : x > 66 ? "the right side" : "the center"}, ${y < 33 ? "near the top" : y > 66 ? "near the bottom" : "in the middle"}.

What is at that location in the image? Explain it in 1-2 fun, educational sentences for a kid. Be specific about what you see there. If you're not sure exactly what they pointed at, describe the most interesting thing in that area.`;

  const response = await genai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  const explanation = response.text ?? "Hmm, I'm not sure what that is! Try pointing at something else.";

  return NextResponse.json({ explanation });
}
