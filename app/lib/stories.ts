export interface Hotspot {
  object: string;
  bbox: [number, number, number, number];
}

export interface Page {
  page_id: string;
  narration: string;
  image_prompt: string;
  image_url: string;
  audio_url: string;
  hotspots: Hotspot[];
  choice: null | {
    question: string;
    option_a: { label: string; pages: Page[] };
    option_b: { label: string; pages: Page[] };
  };
}

export interface Story {
  title: string;
  topic: string;
  narrator: {
    type: "animal" | "custom";
    character: "mouse" | "rabbit" | "owl" | "custom";
    voice_id: string;
  };
  pages: Page[];
  cyu: { type: "voice" | "drag" | "draw"; question: string }[];
}

export const TORNADO_STORY: Omit<Story, "narrator"> = {
  title: "Into the Storm: How Tornadoes Are Born",
  topic: "tornadoes",
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
