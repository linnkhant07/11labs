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

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface Page {
  page_id: string;
  narration: string;
  image_prompt: string;
  image_url: string;
  audio_url: string;
  timestamps?: WordTimestamp[];
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

export function buildImagePrompt(
  scene: Page,
  styleGuide: StyleGuide,
  characters: Character[],
  visual?: PageVisual
): string {
  const v = visual || scene.visual || {};
  const charNames = v.characters || [];
  const charDesc = characters
    .filter((c) => charNames.includes(c.name))
    .map((c) => c.description);

  const hotspotObjects: string[] = (scene.hotspots ?? []).map((h) => h.object).filter(Boolean);
  const educationalElements = hotspotObjects.length
    ? `\n\nRequired Background Educational Elements (ALL THREE must be clearly depicted as background/environmental details — do NOT make them the main subject, do NOT label them with any text):\n${hotspotObjects.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
    : "";

  return `\nChildren's storybook illustration.\n\nStyle:\n${styleGuide.art_style}, ${styleGuide.color_palette}, ${styleGuide.lighting}\n\nCharacters:\n${charDesc.length ? charDesc.join(", ") : "(main characters)"}\n\nScene:\n${v.setting || scene.image_prompt || scene.narration || "(describe the main event)"}${v.action ? ", " + v.action : ""}${educationalElements}\n\nMood:\n${v.mood || ""}\n\nTime:\n${v.time_of_day || ""}\n\nComposition:\nFull bleed illustration. The scene fills the entire image edge to edge with no borders, no frames, no white margins, no vignette, no painted border, no canvas edges showing. Centered subject, cinematic framing.\n\nAbsolutely no text, letters, words, labels, captions, signs, symbols, numbers, or writing of any kind anywhere in the image. No watermark, no border, no frame, no white edges.\n`;
}

export const TORNADO_STORY: Omit<Story, "narrator"> = {
  title: "Into the Storm: How Tornadoes Are Born",
  topic: "tornadoes",
  style_guide: {
    art_style: "watercolor, soft edges, storybook style",
    color_palette: "vivid blues, greens, and grays",
    lighting: "dramatic, stormy, with bright highlights",
  },
  characters: [],
  pages: [
    {
      page_id: "p1",
      narration:
        "High above the flat plains of Oklahoma, two invisible giants are about to collide. One is a blanket of warm, moist air drifting up from the Gulf of Mexico. The other is a sheet of cold, dry air rushing down from Canada. When these two air masses meet, the warm air shoots upward like a rocket — and a massive thunderstorm is born. Scientists call this a supercell, and it is the birthplace of tornadoes.",
      image_prompt: "two air masses colliding over Oklahoma plains",
      image_url: "/images/hardcode_tornado_image1.jpg",
      audio_url: "",
      hotspots: [],
      choice: null,
    },
    {
      page_id: "p2",
      narration:
        "Inside the supercell, winds at different heights blow in different directions. The low winds push one way, the high winds push another. This creates an invisible spinning tube of air lying on its side, like a rolling pin made of wind. But then the powerful updraft — the column of rising warm air — tilts that tube upright. Now it is spinning vertically, reaching from the clouds all the way down toward the ground. A funnel cloud begins to form.",
      image_prompt: "spinning tube of air inside a supercell storm",
      image_url: "/images/hardcode_tornado_image2.jpg",
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
              image_url: "/images/hardcode_tornado_image3.jpg",
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
              image_url: "/images/hardcode_tornado_image3.jpg",
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
      image_url: "/images/hardcode_tornado_image4.jpg",
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

export const PYRAMIDS_STORY: Omit<Story, "narrator"> = {
  title: "Secrets of the Pyramids: Ancient Wonders of Egypt",
  topic: "pyramids",
  style_guide: {
    art_style: "watercolor, warm tones, ancient world storybook style",
    color_palette: "golden sand, warm ochre, deep blue sky, ivory white",
    lighting: "warm golden afternoon sunlight, long shadows",
  },
  characters: [],
  pages: [
    {
      page_id: "p1",
      narration:
        "Imagine standing in the scorching Egyptian desert nearly 4,500 years ago. Thousands of workers are hauling massive limestone blocks — each one heavier than a car — across the sand. They are building the Great Pyramid of Giza, a tomb for Pharaoh Khufu. When finished, it stood 481 feet tall, making it the tallest structure on Earth for over 3,800 years. No cranes, no trucks, no machines — just human strength, clever engineering, and incredible teamwork.",
      image_prompt: "ancient Egyptian workers building the Great Pyramid under blazing sun, hauling limestone blocks",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: null,
    },
    {
      page_id: "p2",
      narration:
        "But why build something so enormous? The ancient Egyptians believed that when a pharaoh died, their spirit needed a safe place to live forever. The pyramid was that home — filled with food, gold, furniture, and even boats for the pharaoh's journey to the afterlife. Deep inside the pyramid, hidden chambers and narrow passageways were designed to protect the pharaoh's mummy from tomb robbers. Some of these secret rooms were not discovered until thousands of years later!",
      image_prompt: "cross-section of a pyramid showing hidden chambers, passageways, and the pharaoh's burial room with treasures",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: null,
    },
    {
      page_id: "p3",
      narration:
        "Here is one of the biggest mysteries in history: how did the Egyptians actually move those giant blocks? Each block weighed about 2.5 tons — that is as heavy as two cars stacked on top of each other! Scientists and historians have been debating this question for centuries, and they have come up with some fascinating theories.",
      image_prompt: "massive limestone block on wooden sled being pulled by workers, with water being poured on sand in front",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: {
        question: "How do you think the Egyptians moved those massive blocks?",
        option_a: {
          label: "Ramps and sleds on wet sand",
          image_prompt: "",
          image_url: "",
          pages: [
            {
              page_id: "p4a",
              narration:
                "Many scientists believe the Egyptians built long ramps out of mud bricks and rubble. Workers placed the stone blocks on wooden sleds, then poured water on the sand in front to make it slippery — cutting the friction in half! A team of workers would pull the sled up the ramp, block by block. As the pyramid grew taller, the ramp grew longer. It was slow, exhausting work, but it was brilliant engineering for a world without machines.",
              image_prompt: "workers pulling a stone block up a long ramp alongside a half-built pyramid, water glistening on sand",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
            {
              page_id: "p5a",
              narration:
                "Recent discoveries have made this theory even more convincing. In 2018, archaeologists found a 4,500-year-old ramp at a quarry in Hatnub, Egypt. The ramp had holes on both sides where wooden posts were placed — workers likely used ropes wrapped around these posts to pull blocks uphill even more efficiently. This discovery showed that the ancient Egyptians were even more clever than we imagined!",
              image_prompt: "archaeologists examining an ancient ramp with wooden post holes at an Egyptian quarry site",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
          ],
        },
        option_b: {
          label: "A water channel system inside",
          image_prompt: "",
          image_url: "",
          pages: [
            {
              page_id: "p4b",
              narration:
                "Some researchers think the Egyptians might have used water to float the heavy blocks! They may have built channels or canals from the Nile River right up to the construction site. The blocks could have been loaded onto boats or rafts and floated close to where they were needed. The Nile flooded every year, and the Egyptians were masters at controlling water flow.",
              image_prompt: "limestone blocks floating on wooden rafts through a canal leading to the pyramid construction site, Nile River in background",
              image_url: "",
              audio_url: "",
              hotspots: [],
              choice: null,
            },
            {
              page_id: "p5b",
              narration:
                "In 2024, scientists discovered a hidden branch of the Nile River that once flowed right next to the pyramids at Giza! This ancient waterway has since dried up, but it explains how the Egyptians could have transported millions of stone blocks from quarries far away. The river was their highway — and the pyramids were built right at the loading dock.",
              image_prompt: "map showing the ancient hidden branch of the Nile flowing past the Giza pyramids",
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
      page_id: "p6",
      narration:
        "The pyramids have stood for nearly 4,500 years — surviving earthquakes, sandstorms, and even tomb robbers. They are the last of the Seven Wonders of the Ancient World still standing. Every block, every passageway, every hidden chamber tells a story about a civilization that dreamed big and built even bigger. Next time you see a picture of the pyramids, remember — you are looking at one of the greatest achievements in all of human history.",
      image_prompt: "the three Giza pyramids at sunset with the Sphinx in the foreground, golden light",
      image_url: "",
      audio_url: "",
      hotspots: [],
      choice: null,
    },
  ],
  cyu: [
    { type: "voice", question: "Why did the Egyptians build pyramids?" },
    { type: "voice", question: "How heavy was each limestone block in the Great Pyramid?" },
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
        break;
      }
    }
  }

  return result;
}
