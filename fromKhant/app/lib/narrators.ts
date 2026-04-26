export type NarratorId = "fox" | "sloth" | "grandma" | "custom";

export type NarratorInfo = {
  name: string;
  short: string;
  image?: string;
  bg: string;
};

export const NARRATORS: Record<NarratorId, NarratorInfo> = {
  fox: {
    name: "Finn the Fox",
    short: "Finn",
    image: "/figma/landing/finn-fox.png",
    bg: "#ffeeca",
  },
  sloth: {
    name: "Sally the Sloth",
    short: "Sally",
    image: "/figma/landing/sally-sloth.png",
    bg: "#f0dac6",
  },
  grandma: {
    name: "Grandma",
    short: "Grandma",
    image: "/figma/landing/grandma.png",
    bg: "transparent",
  },
  custom: {
    name: "Your Voice",
    short: "You",
    bg: "#ffeeca",
  },
};

export const NARRATOR_VOICE_IDS: Record<NarratorId, string> = {
  fox: "dfZGXKiIzjizWtJ0NgPy",
  sloth: "vGQNBgLaiM3EdZtxIiuY",
  grandma: "XsmrVB66q3D4TaXVaWNF",
  custom: "dfZGXKiIzjizWtJ0NgPy",
};

export const DEFAULT_NARRATOR: NarratorId = "fox";

export function isNarratorId(value: string): value is NarratorId {
  return value in NARRATORS;
}

export function getVoiceId(id: NarratorId, customVoiceId?: string | null): string {
  if (id === "custom" && customVoiceId) return customVoiceId;
  return NARRATOR_VOICE_IDS[id];
}
