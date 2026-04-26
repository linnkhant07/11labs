export type NarratorId = "mouse" | "rabbit" | "owl" | "custom";

export type NarratorInfo = {
  name: string;
  short: string;
  image?: string;
  bg: string;
};

export const NARRATORS: Record<NarratorId, NarratorInfo> = {
  mouse: {
    name: "Finn the Fox",
    short: "Finn",
    image: "/figma/landing/finn-fox.png",
    bg: "#ffeeca",
  },
  rabbit: {
    name: "Sally the Sloth",
    short: "Sally",
    image: "/figma/landing/sally-sloth.png",
    bg: "#f0dac6",
  },
  owl: {
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
  mouse: "dfZGXKiIzjizWtJ0NgPy",
  rabbit: "vGQNBgLaiM3EdZtxIiuY",
  owl: "XsmrVB66q3D4TaXVaWNF",
  custom: "dfZGXKiIzjizWtJ0NgPy",
};

export const DEFAULT_NARRATOR: NarratorId = "mouse";

export function isNarratorId(value: string): value is NarratorId {
  return value in NARRATORS;
}

export function getVoiceId(id: NarratorId, customVoiceId?: string | null): string {
  if (id === "custom" && customVoiceId) return customVoiceId;
  return NARRATOR_VOICE_IDS[id];
}
