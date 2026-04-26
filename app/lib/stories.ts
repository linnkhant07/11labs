import { collectAllPages } from "./generateUtils";

/**
 * Build an image prompt for a storybook page, using style guide and character info.
 * @param scene - The page object (should include a 'visual' field for advanced use, or fallback to image_prompt/narration)
 * @param styleGuide - The style guide object
 * @param characters - The array of character objects
 * @param visual (optional) - If present, overrides scene.visual
 */
export function buildImagePrompt(
  scene: any,
  styleGuide: StyleGuide,
  characters: Character[],
  visual?: {
    characters?: string[];
    setting?: string;
    action?: string;
    mood?: string;
    time_of_day?: string;
  }
): string {
  // Use scene.visual if present, else fallback to minimal info
  const v = visual || scene.visual || {};
  const charNames = v.characters || [];
  const charDesc = characters
    .filter((c) => charNames.includes(c.name))
    .map((c) => c.description);

  const hotspotObjects: string[] = (scene.hotspots ?? []).map((h: Hotspot) => h.object).filter(Boolean);
  const educationalElements = hotspotObjects.length
    ? `\n\nRequired Background Educational Elements (ALL THREE must be clearly depicted as background/environmental details — do NOT make them the main subject, do NOT label them with any text):\n${hotspotObjects.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
    : "";

  return `\nChildren's storybook illustration.\n\nStyle:\n${styleGuide.art_style}, ${styleGuide.color_palette}, ${styleGuide.lighting}\n\nCharacters:\n${charDesc.length ? charDesc.join(", ") : "(main characters)"}\n\nScene:\n${v.setting || scene.image_prompt || scene.narration || "(describe the main event)"}${v.action ? ", " + v.action : ""}${educationalElements}\n\nMood:\n${v.mood || ""}\n\nTime:\n${v.time_of_day || ""}\n\nComposition:\nFull bleed illustration. The scene fills the entire image edge to edge with no borders, no frames, no white margins, no vignette, no painted border, no canvas edges showing. Centered subject, cinematic framing.\n\nAbsolutely no text, letters, words, labels, captions, signs, symbols, numbers, or writing of any kind anywhere in the image. No watermark, no border, no frame, no white edges.\n`;
}

/**
 * Generate image prompts for every page in a story, including branches.
 */
export function generateImagePromptsForStory(
  story: Pick<Story, "pages" | "style_guide" | "characters">
): { page_id: string; prompt: string }[] {
  const allPages = collectAllPages(story.pages);
  return allPages.map((page) => ({
    page_id: page.page_id,
    prompt: buildImagePrompt(page, story.style_guide, story.characters),
  }));
}

export interface Hotspot {
  object: string;
}

export interface PageVisual {
  characters?: string[];
  setting?: string;
  action?: string;
  mood?: string;
  time_of_day?: string;
}

export interface Page {
  page_id: string;
  narration: string;
  image_prompt: string;
  image_url: string;
  audio_url: string;
  hotspots: Hotspot[];
  visual?: PageVisual;
  choice: null | {
    question: string;
    option_a: { label: string; image_prompt: string; image_url: string; pages: Page[] };
    option_b: { label: string; image_prompt: string; image_url: string; pages: Page[] };
  };
}

export interface StyleGuide {
  art_style: string;
  color_palette: string;
  lighting: string;
}

export interface Character {
  name: string;
  description: string;
}

export interface Story {
  title: string;
  topic: string;
  narrator: {
    type: "animal" | "custom";
    character: "mouse" | "rabbit" | "owl" | "custom";
    voice_id: string;
  };
  style_guide: StyleGuide;
  characters: Character[];
  pages: Page[];
  cyu: { type: "voice" | "drag" | "draw"; question: string }[];
}

export const TORNADO_STORY: Omit<Story, "narrator"> = {
  title: "Into the Storm: How Tornadoes Are Born",
  topic: "tornadoes",
  style_guide: {
    art_style: "watercolor, soft edges, storybook style",
    color_palette: "vivid blues, greens, and grays",
    lighting: "dramatic, stormy, with bright highlights"
  },
  characters: [
    { name: "Tornado", description: "A swirling, powerful funnel cloud" },
    { name: "Scientist", description: "A friendly meteorologist in a raincoat" },
    { name: "Child", description: "Curious child with wide eyes and rain boots" }
  ],
  pages: [
    {
      page_id: "p1",
      narration:
        "High above the flat plains of Oklahoma, two invisible giants are about to collide. One is a blanket of warm, moist air drifting up from the Gulf of Mexico. The other is a sheet of cold, dry air rushing down from Canada. When these two air masses meet, the warm air shoots upward like a rocket — and a massive thunderstorm is born. Scientists call this a supercell, and it is the birthplace of tornadoes.",
      image_prompt: "two air masses colliding over Oklahoma plains",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: null,
    },
    {
      page_id: "p2",
      narration:
        "Inside the supercell, winds at different heights blow in different directions. The low winds push one way, the high winds push another. This creates an invisible spinning tube of air lying on its side, like a rolling pin made of wind. But then the powerful updraft — the column of rising warm air — tilts that tube upright. Now it is spinning vertically, reaching from the clouds all the way down toward the ground. A funnel cloud begins to form.",
      image_prompt: "spinning tube of air inside a supercell storm",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: {
        question: "The funnel cloud is getting closer to the ground. What should we learn about next?",
        option_a: {
          label: "How fast can a tornado spin?",
          image_prompt: "",
          image_url: "",
          pages: [
            {
              page_id: "p3a",
              narration:
                "The winds inside a tornado can spin incredibly fast — the strongest ones reach over 300 miles per hour! Scientists use something called the Enhanced Fujita Scale to measure tornado strength. An EF0 tornado might knock over a trash can, but an EF5 tornado can lift an entire house off the ground and carry it through the air. Most tornadoes are EF0 or EF1, which means they are dangerous but not the world-enders you see in movies.",
              image_prompt: "diagram of Enhanced Fujita Scale tornado categories",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
            {
              page_id: "p4a",
              narration:
                "Even though tornadoes are powerful, they usually do not last very long. Most tornadoes touch down for less than ten minutes and travel only a few miles. But in rare cases, a tornado can stay on the ground for over an hour and carve a path more than a hundred miles long. The Tri-State Tornado of 1925 traveled 219 miles across three states — Missouri, Illinois, and Indiana — and remains the deadliest tornado in American history.",
              image_prompt: "map showing Tri-State Tornado path across three states",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
          ],
        },
        option_b: {
          label: "How do scientists track tornadoes?",
          image_prompt: "",
          image_url: "",
          pages: [
            {
              page_id: "p3b",
              narration:
                "Storm chasers and meteorologists work together to track tornadoes. They use Doppler radar, which sends out radio waves that bounce off raindrops inside storms. By measuring how those waves come back, radar can detect the spinning motion inside a storm — even before a tornado forms. When radar spots that signature spin, the National Weather Service sends out a tornado warning so people can take shelter.",
              image_prompt: "Doppler radar screen showing tornado signature rotation",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
            {
              page_id: "p4b",
              narration:
                "Some of the bravest scientists actually drive right up to tornadoes to study them. They place special instruments called 'probes' in the tornado's path. These probes measure wind speed, air pressure, temperature, and humidity right inside the funnel. The data they collect helps scientists build better warning systems, giving families more time to get to safety. Every minute of extra warning can save lives.",
              image_prompt: "storm chasers deploying probes near a tornado",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
          ],
        },
      },
    },
    {
      page_id: "p5",
      narration:
        "Now you know the secret life of tornadoes — how warm and cold air battle in the sky, how spinning winds create a funnel, and how brave scientists chase storms to keep us safe. Tornadoes are one of nature's most powerful forces, but understanding them is the first step to staying safe. Next time you hear thunder rumble in the distance, you will know exactly what is happening miles above your head.",
      image_prompt: "child looking up at a clearing sky after a storm, rainbow forming",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: null,
    },
  ],
  cyu: [
    { type: "voice", question: "What two air masses collide to create a supercell?" },
    { type: "voice", question: "What scale do scientists use to measure tornado strength?" },
  ],
};

/** Flatten a story's pages in reading order (before any branch) up to the choice, then append chosen branch + remaining pages */
export function getReadingOrder(pages: Page[], branchChoices: Record<string, "a" | "b">): Page[] {
  const result: Page[] = [];

  for (const page of pages) {
    result.push(page);

    if (page.choice) {
      const chosen = branchChoices[page.page_id];
      if (chosen === "a") {
        result.push(...page.choice.option_a.pages);
      } else if (chosen === "b") {
        result.push(...page.choice.option_b.pages);
      } else {
        // Stop here — choice not yet made
        break;
      }
    }
  }

  return result;
}
