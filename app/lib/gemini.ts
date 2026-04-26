import { GoogleGenAI } from "@google/genai";
import type { StyleGuide, Character, PageVisual } from "./stories";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";

export interface RawPage {
  page_id: string;
  narration: string;
  image_prompt: string;
  hotspots?: { object: string }[];
  visual?: PageVisual;
  choice?: {
    question: string;
    option_a: { label: string; pages: RawPage[] };
    option_b: { label: string; pages: RawPage[] };
  };
}

export interface RawStoryData {
  title: string;
  topic: string;
  style_guide: StyleGuide;
  characters: Character[];
  pages: RawPage[];
}

export async function generateStoryData(
  topic: string,
  storyPrompt: string
): Promise<RawStoryData> {
  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${storyPrompt}\n\nTopic: ${topic}`,
    config: { responseMimeType: "application/json" },
  });

  if (!response.text) throw new Error("Gemini returned empty story response");
  return JSON.parse(response.text) as RawStoryData;
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    const response = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio: "16:9" },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
      }
    }

    console.warn("[gemini] No image part in response for prompt:", prompt.slice(0, 80));
    return "";
  } catch (err) {
    console.error("[gemini] Image generation failed:", err);
    return "";
  }
}
