"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_NARRATOR,
  NARRATORS,
  type NarratorId,
  type NarratorInfo,
  getVoiceId,
  isNarratorId,
} from "../lib/narrators";

const LS_NARRATOR = "educate:narrator";
const LS_CUSTOM_VOICE = "educate:custom-voice-id";

type NarratorContextValue = {
  narratorId: NarratorId;
  voiceId: string;
  customVoiceId: string | null;
  info: NarratorInfo;
  hasChosen: boolean;
  libraryId: string | null;
  setNarrator: (id: NarratorId) => void;
  setCustomVoice: (voiceId: string | null) => void;
  setLibraryId: (id: string | null) => void;
};

const NarratorContext = createContext<NarratorContextValue | null>(null);

export function NarratorProvider({ children }: { children: React.ReactNode }) {
  const [narratorId, setNarratorState] = useState<NarratorId>(DEFAULT_NARRATOR);
  const [customVoiceId, setCustomVoiceState] = useState<string | null>(null);
  const [hasChosen, setHasChosen] = useState(false);
  const [libraryId, setLibraryIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedNarrator = localStorage.getItem(LS_NARRATOR);
      if (storedNarrator && isNarratorId(storedNarrator)) {
        setNarratorState(storedNarrator);
        setHasChosen(true);
      }
      const storedVoice = localStorage.getItem(LS_CUSTOM_VOICE);
      if (storedVoice) setCustomVoiceState(storedVoice);
    } catch {
      // localStorage unavailable — keep defaults.
    }
  }, []);

  const setNarrator = useCallback((id: NarratorId) => {
    setNarratorState(id);
    setHasChosen(true);
    try {
      localStorage.setItem(LS_NARRATOR, id);
    } catch {}
  }, []);

  const setCustomVoice = useCallback((voiceId: string | null) => {
    setCustomVoiceState(voiceId);
    try {
      if (voiceId) localStorage.setItem(LS_CUSTOM_VOICE, voiceId);
      else localStorage.removeItem(LS_CUSTOM_VOICE);
    } catch {}
  }, []);

  const setLibraryId = useCallback((id: string | null) => {
    setLibraryIdState(id);
  }, []);

  const value = useMemo<NarratorContextValue>(
    () => ({
      narratorId,
      customVoiceId,
      voiceId: getVoiceId(narratorId, customVoiceId),
      info: NARRATORS[narratorId],
      hasChosen,
      libraryId,
      setNarrator,
      setCustomVoice,
      setLibraryId,
    }),
    [narratorId, customVoiceId, hasChosen, libraryId, setNarrator, setCustomVoice, setLibraryId]
  );

  return (
    <NarratorContext.Provider value={value}>{children}</NarratorContext.Provider>
  );
}

export function useNarrator(): NarratorContextValue {
  const ctx = useContext(NarratorContext);
  if (!ctx) {
    throw new Error("useNarrator must be used inside NarratorProvider");
  }
  return ctx;
}
