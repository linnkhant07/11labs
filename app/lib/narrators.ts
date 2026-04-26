export type NarratorId = "fox" | "sloth" | "custom";

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
  custom: {
    name: "Your Voice",
    short: "You",
    bg: "#ffeeca",
  },
};

export const NARRATOR_VOICE_IDS: Record<NarratorId, string> = {
  fox: "O0Z1x41tJjKexAPlfNNL",
  sloth: "WAhoMTNdLdMoq1j3wf3I",
  custom: "O0Z1x41tJjKexAPlfNNL",
};

export const DEFAULT_NARRATOR: NarratorId = "fox";

export function isNarratorId(value: string): value is NarratorId {
  return value in NARRATORS;
}

export function getVoiceId(id: NarratorId, customVoiceId?: string | null): string {
  if (id === "custom" && customVoiceId) return customVoiceId;
  return NARRATOR_VOICE_IDS[id];
}
