import { GoogleGenAI } from "@google/genai";
import type { StyleGuide, Character, PageVisual } from "./stories";

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: { timeout: 5 * 60_000 },
});

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";

export interface RawPage {
  page_id: string;
  narration: string;
  image_prompt: string;
  hotspots?: { object: string }[];
  visual?: PageVisual;
  choice?: {
    question: string;
    option_a: { label: string; image_prompt: string; pages: RawPage[] };
    option_b: { label: string; image_prompt: string; pages: RawPage[] };
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
  console.log(`[gemini] Generating story JSON for "${topic}"...`);
  const t0 = Date.now();
  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${storyPrompt}\n\nTopic: ${topic}`,
    config: { responseMimeType: "application/json" },
  });
  console.log(`[gemini] Story JSON received in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (!response.text) throw new Error("Gemini returned empty story response");
  const data = JSON.parse(response.text) as RawStoryData;
  console.log(`[gemini] Parsed story: "${data.title}" — ${data.pages.length} top-level pages, ${data.characters?.length ?? 0} characters`);
  return data;
}

let imageCounter = 0;

export async function generateImage(prompt: string, label?: string): Promise<string> {
  const id = ++imageCounter;
  const tag = label ? `[gemini] Image #${id} (${label})` : `[gemini] Image #${id}`;
  console.log(`${tag} — starting...`);
  const t0 = Date.now();
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
        const sizeKB = Math.round((part.inlineData.data.length * 3) / 4 / 1024);
        console.log(`${tag} — done in ${((Date.now() - t0) / 1000).toFixed(1)}s (${sizeKB}KB)`);
        return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
      }
    }

    console.warn(`${tag} — no image in response after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return "";
  } catch (err) {
    console.error(`${tag} — FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s:`, err);
    return "";
  }
}
