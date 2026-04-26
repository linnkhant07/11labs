import { NextRequest, NextResponse } from "next/server";
import type { Page, Story } from "../../lib/stories";
import { buildImagePrompt } from "../../lib/stories";
import { collectAllPages, collectAllChoices } from "../../lib/generateUtils";
import { generateStoryData, generateImage, type RawPage } from "../../lib/gemini";
import { generateAudioWithTimestamps, resolveVoiceId } from "../../lib/elevenlabs";
import { saveStoryToDisk } from "../../lib/storyStorage";
import { STORY_PROMPT } from "../../lib/prompts";

function rawPageToPage(raw: RawPage): Page {
  return {
    page_id: raw.page_id,
    narration: raw.narration,
    image_prompt: raw.image_prompt,
    image_url: "",
    audio_url: "",
    hotspots: (raw.hotspots ?? []).map((h) => ({ object: h.object })),
    visual: raw.visual,
    choice: raw.choice
      ? {
          question: raw.choice.question,
          option_a: {
            label: raw.choice.option_a.label,
            image_prompt: raw.choice.option_a.image_prompt,
            image_url: "",
            pages: raw.choice.option_a.pages.map(rawPageToPage),
          },
          option_b: {
            label: raw.choice.option_b.label,
            image_prompt: raw.choice.option_b.image_prompt,
            image_url: "",
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

  const { topic, narrator, voiceId: customVoiceId } = body as {
    topic: string;
    narrator: string;
    voiceId?: string;
  };
  const voiceId = resolveVoiceId(narrator, customVoiceId);

  try {
    // 1. Generate story structure with Gemini
    console.log("[generate] Generating story JSON for topic:", topic);
    const t0 = Date.now();
    const raw = await generateStoryData(topic, STORY_PROMPT);
    console.log(`[generate] Story JSON done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${raw.pages.length} top-level pages`);

    const pages = raw.pages.map(rawPageToPage);
    const allPages = collectAllPages(pages);
    const allChoices = collectAllChoices(pages);
    console.log(`[generate] Total pages: ${allPages.length}, choices: ${allChoices.length}`);

    // 2. Generate ALL images + audio in parallel (like Angela's original)
    console.log(`[generate] Starting ${allPages.length} page images + ${allChoices.length * 2} choice images + ${allPages.length} audio clips — all parallel`);
    const t1 = Date.now();

    const [imageUrls, audioUrls, choiceImageUrls] = await Promise.all([
      Promise.all(
        allPages.map((p) =>
          generateImage(buildImagePrompt(p, raw.style_guide, raw.characters), p.page_id)
        )
      ),
      Promise.all(allPages.map((p) => generateAudioWithTimestamps(p.narration, voiceId, p.page_id))),
      Promise.all(
        allChoices.flatMap((c, i) => [
          generateImage(c.option_a.image_prompt, `choice-${i}-a`),
          generateImage(c.option_b.image_prompt, `choice-${i}-b`),
        ])
      ),
    ]);

    console.log(`[generate] All assets done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

    // 3. Assign generated assets back to pages
    allPages.forEach((page, i) => {
      page.image_url = imageUrls[i];
      page.audio_url = audioUrls[i].audioUrl;
      page.timestamps = audioUrls[i].timestamps;
    });

    allChoices.forEach((choice, i) => {
      choice.option_a.image_url = choiceImageUrls[i * 2];
      choice.option_b.image_url = choiceImageUrls[i * 2 + 1];
    });

    const story: Story = {
      title: raw.title,
      topic: raw.topic ?? topic,
      style_guide: raw.style_guide,
      characters: raw.characters,
      narrator: {
        type: customVoiceId ? "custom" : "animal",
        character: (customVoiceId ? "custom" : narrator) as Story["narrator"]["character"],
        voice_id: voiceId,
      },
      pages,
      cyu: [],
    };

    // 4. Upload images to Cloudinary + cache story JSON
    console.log("[generate] Uploading to Cloudinary...");
    await saveStoryToDisk(story, allPages);
    console.log(`[generate] Done! Total time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    return NextResponse.json(story);
  } catch (err) {
    console.error("[/api/generate]", err);
    return NextResponse.json({ error: "Story generation failed" }, { status: 500 });
  }
}
