import { NextRequest, NextResponse } from "next/server";
import type { Page, Story } from "../../lib/stories";
import { buildImagePrompt } from "../../lib/stories";
import { collectAllPages } from "../../lib/generateUtils";
import { generateStoryData, generateImage, type RawPage } from "../../lib/gemini";
import { generateAudio, resolveVoiceId } from "../../lib/elevenlabs";
import { saveStoryToDisk } from "../../lib/storyStorage";
import { STORY_PROMPT } from "../../lib/prompts";

function rawPageToPage(raw: RawPage): Page {
  return {
    page_id: raw.page_id,
    narration: raw.narration,
    image_prompt: raw.image_prompt,
    image_url: "",
    audio_url: "",
    hotspots: [],
    visual: raw.visual,
    choice: raw.choice
      ? {
          question: raw.choice.question,
          option_a: {
            label: raw.choice.option_a.label,
            pages: raw.choice.option_a.pages.map(rawPageToPage),
          },
          option_b: {
            label: raw.choice.option_b.label,
            pages: raw.choice.option_b.pages.map(rawPageToPage),
          },
        }
      : null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.topic !== "string" ||
    typeof body.narrator !== "string"
  ) {
    return NextResponse.json(
      { error: "topic and narrator are required" },
      { status: 400 }
    );
  }

  const { topic, narrator } = body as { topic: string; narrator: string };
  const voiceId = resolveVoiceId(narrator);

  try {
    const raw = await generateStoryData(topic, STORY_PROMPT);
    const pages = raw.pages.map(rawPageToPage);
    const allPages = collectAllPages(pages);

    const [imageUrls, audioUrls] = await Promise.all([
      Promise.all(
        allPages.map((p) =>
          generateImage(buildImagePrompt(p, raw.style_guide, raw.characters))
        )
      ),
      Promise.all(allPages.map((p) => generateAudio(p.narration, voiceId))),
    ]);

    allPages.forEach((page, i) => {
      page.image_url = imageUrls[i];
      page.audio_url = audioUrls[i];
    });

    const story: Story = {
      title: raw.title,
      topic: raw.topic ?? topic,
      style_guide: raw.style_guide,
      characters: raw.characters,
      narrator: {
        type: "animal",
        character: narrator as Story["narrator"]["character"],
        voice_id: voiceId,
      },
      pages,
      cyu: [],
    };

    await saveStoryToDisk(story, allPages);
    return NextResponse.json(story);
  } catch (err) {
    console.error("[/api/generate]", err);
    return NextResponse.json({ error: "Story generation failed" }, { status: 500 });
  }
}
