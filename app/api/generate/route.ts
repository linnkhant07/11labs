import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Page } from "../../lib/stories";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const VOICE_MAP: Record<string, string | undefined> = {
  mouse: process.env.ELEVENLABS_MOUSE_VOICE_ID,
  rabbit: process.env.ELEVENLABS_RABBIT_VOICE_ID,
  owl: process.env.ELEVENLABS_OWL_VOICE_ID,
};

const STORY_PROMPT = `You are an educational storyteller for children ages 6-12, especially those with ADHD. Generate an engaging, educational storybook about the given topic.

RULES:
- Write 3 pages of narration BEFORE a branching choice
- The choice should offer 2 paths, each with 2 more pages
- After the branches, write 1 final concluding page
- Each page's narration should be 3-5 sentences, vivid and engaging
- Include real educational facts — this is not fiction, it's a fun way to learn real science/history
- Write at a level appropriate for ages 6-12
- Keep attention by using dramatic language, questions, and sensory details (important for ADHD)
- Each page needs an image_prompt: a short description of what the illustration should show (vivid, specific, child-friendly)

Return ONLY valid JSON matching this exact structure:
{
  "title": "string",
  "topic": "string",
  "pages": [
    {
      "page_id": "p1",
      "narration": "string",
      "image_prompt": "string"
    },
    {
      "page_id": "p2",
      "narration": "string",
      "image_prompt": "string"
    },
    {
      "page_id": "p3",
      "narration": "string",
      "image_prompt": "string",
      "choice": {
        "question": "string",
        "option_a": {
          "label": "string (short, 5-8 words)",
          "pages": [
            { "page_id": "p4a", "narration": "string", "image_prompt": "string" },
            { "page_id": "p5a", "narration": "string", "image_prompt": "string" }
          ]
        },
        "option_b": {
          "label": "string (short, 5-8 words)",
          "pages": [
            { "page_id": "p4b", "narration": "string", "image_prompt": "string" },
            { "page_id": "p5b", "narration": "string", "image_prompt": "string" }
          ]
        }
      }
    },
    {
      "page_id": "p6",
      "narration": "string",
      "image_prompt": "string"
    }
  ]
}`;

async function generateAudioForPage(
  text: string,
  voiceId: string
): Promise<string> {
  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  // Collect ReadableStream into a buffer and return as base64 data URL
  const reader = (audioStream as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  const base64 = buffer.toString("base64");
  return `data:audio/mpeg;base64,${base64}`;
}

function collectAllPages(pages: Page[]): Page[] {
  const all: Page[] = [];
  for (const page of pages) {
    all.push(page);
    if (page.choice) {
      all.push(...page.choice.option_a.pages);
      all.push(...page.choice.option_b.pages);
    }
  }
  return all;
}

export async function POST(req: NextRequest) {
  const { topic, narrator } = (await req.json()) as {
    topic: string;
    narrator: string;
  };

  const voiceId = VOICE_MAP[narrator] || process.env.ELEVENLABS_MOUSE_VOICE_ID!;

  // 1. Generate story with Gemini
  const response = await genai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${STORY_PROMPT}\n\nTopic: ${topic}`,
    config: {
      responseMimeType: "application/json",
    },
  });

  const storyData = JSON.parse(response.text ?? "{}");

  // 2. Build full Page objects from Gemini response
  function toPage(raw: Record<string, unknown>): Page {
    const rawChoice = raw.choice as Record<string, unknown> | undefined;
    return {
      page_id: raw.page_id as string,
      narration: raw.narration as string,
      image_prompt: raw.image_prompt as string,
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: rawChoice
        ? {
            question: rawChoice.question as string,
            option_a: {
              label: (rawChoice.option_a as Record<string, unknown>).label as string,
              pages: (
                (rawChoice.option_a as Record<string, unknown>).pages as Record<string, unknown>[]
              ).map(toPage),
            },
            option_b: {
              label: (rawChoice.option_b as Record<string, unknown>).label as string,
              pages: (
                (rawChoice.option_b as Record<string, unknown>).pages as Record<string, unknown>[]
              ).map(toPage),
            },
          }
        : null,
    };
  }

  const pages: Page[] = (storyData.pages as Record<string, unknown>[]).map(toPage);

  // 3. Generate TTS for ALL pages in parallel (including branch pages)
  const allPages = collectAllPages(pages);
  const audioPromises = allPages.map((page) =>
    generateAudioForPage(page.narration, voiceId)
  );
  const audioUrls = await Promise.all(audioPromises);

  // Assign audio URLs back to pages
  const audioMap = new Map<string, string>();
  allPages.forEach((page, i) => {
    audioMap.set(page.page_id, audioUrls[i]);
  });

  function assignAudio(pages: Page[]) {
    for (const page of pages) {
      page.audio_url = audioMap.get(page.page_id) ?? "";
      if (page.choice) {
        assignAudio(page.choice.option_a.pages);
        assignAudio(page.choice.option_b.pages);
      }
    }
  }
  assignAudio(pages);

  return NextResponse.json({
    title: storyData.title,
    topic: storyData.topic ?? topic,
    narrator: {
      type: "animal" as const,
      character: narrator,
      voice_id: voiceId,
    },
    pages,
    cyu: [],
  });
}
