"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversationalPtt } from "./lib/useConversationalPtt";

const NARRATORS = [
  { id: "fox", emoji: "\ud83e\udd8a", name: "Fiona the Fox", color: "from-orange-400 to-amber-500" },
  { id: "owl", emoji: "\ud83e\udd89", name: "Oliver the Owl", color: "from-indigo-400 to-purple-500" },
  { id: "bear", emoji: "\ud83d\udc3b", name: "Bruno the Bear", color: "from-amber-600 to-yellow-700" },
] as const;

type NarratorId = (typeof NARRATORS)[number]["id"];

const NARRATOR_ALIASES: Record<NarratorId, string[]> = {
  fox: ["fox", "fiona", "fiona fox"],
  owl: ["owl", "oliver", "oliver owl"],
  bear: ["bear", "bruno", "bruno bear"],
};

const YES_WORDS = ["yes", "yeah", "yep", "correct", "right", "sounds good"];
const NO_WORDS = ["no", "nope", "wrong", "different", "change"];
const NARRATOR_AGENT_IDS: Record<NarratorId, string | undefined> = {
  fox: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_FOX,
  owl: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_OWL,
  bear: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_BEAR,
};

export default function Home() {
  const router = useRouter();
  const [narrator, setNarrator] = useState<NarratorId | null>(null);
  const [pendingNarrator, setPendingNarrator] = useState<NarratorId | null>(null);
  const [agentPrompt, setAgentPrompt] = useState(
    "Press Start Voice Onboarding so I can help you choose a narrator."
  );
  const [hasStartedVoice, setHasStartedVoice] = useState(false);
  const [activeAgentId] = useState<string | undefined>(
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID
  );
  const pendingNarratorRef = useRef<NarratorId | null>(null);

  const selectedNarrator = useMemo(
    () => NARRATORS.find((n) => n.id === narrator) ?? null,
    [narrator]
  );

  const beginStory = useCallback(
    (chosenNarrator: NarratorId) => {
      router.push(`/story?topic=tornadoes&narrator=${chosenNarrator}`);
    },
    [router]
  );

  const narratorDisplayName = useCallback((id: NarratorId): string => {
    return NARRATORS.find((n) => n.id === id)?.name ?? id;
  }, []);

  const {
    connect,
    disconnect,
    startTalking,
    stopTalking,
    sendUserMessage,
    isConnected,
    isConnecting,
    error,
    lastUserTranscript,
    lastAgentTranscript,
  } = useConversationalPtt({
    agentId: activeAgentId,
    inputGain: 2.5,
    onUserTranscript: (transcript) => {
      const spokenNarrator = detectNarrator(transcript);
      const pending = pendingNarratorRef.current;

      if (pending) {
        if (includesAny(transcript, YES_WORDS)) {
          setNarrator(pending);
          setAgentPrompt(
            `Awesome. Locking in ${narratorDisplayName(pending)} and starting your adventure.`
          );
          beginStory(pending);
          return;
        }
        if (spokenNarrator) {
          setPendingNarrator(spokenNarrator);
          setAgentPrompt(
            `Got it, switching to ${narratorDisplayName(
              spokenNarrator
            )}. Say yes if that's right.`
          );
          return;
        }
        if (includesAny(transcript, NO_WORDS)) {
          setPendingNarrator(null);
          setAgentPrompt("No problem. Say Fox, Owl, or Bear to choose your narrator.");
          return;
        }
        setAgentPrompt(
          `Please confirm. Say yes for ${narratorDisplayName(
            pending
          )}, or say another narrator name.`
        );
        return;
      }

      if (spokenNarrator) {
        setPendingNarrator(spokenNarrator);
        setAgentPrompt(
          `I heard ${narratorDisplayName(
            spokenNarrator
          )}. Say yes to confirm, or say a different narrator.`
        );
        return;
      }

      setAgentPrompt("I did not catch a narrator yet. Say Fox, Owl, or Bear.");
    },
    onToolCall: async ({ toolName, parameters }) => {
      if (toolName !== "select_narrator") {
        return { result: `Unknown tool ${toolName}`, isError: true };
      }

      const narratorParam =
        typeof parameters.narrator === "string" ? parameters.narrator.toLowerCase() : "";
      if (!["fox", "owl", "bear"].includes(narratorParam)) {
        return {
          result:
            "Invalid narrator parameter. Expected narrator one of: fox, owl, bear.",
          isError: true,
        };
      }

      const id = narratorParam as NarratorId;
      const narratorAgentId =
        NARRATOR_AGENT_IDS[id] ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
      if (!narratorAgentId) {
        setAgentPrompt(
          `Missing narrator agent ID for ${narratorDisplayName(
            id
          )}. Add NEXT_PUBLIC_ELEVENLABS_AGENT_ID_${id.toUpperCase()} or server mapping env.`
        );
        return { result: "Narrator agent ID missing.", isError: true };
      }

      setNarrator(id);
      setPendingNarrator(null);
      setAgentPrompt(`Selected ${narratorDisplayName(id)}. Starting story now...`);
      beginStory(id);

      return {
        result: `Narrator ${id} selected and navigation started.`,
      };
    },
  });

  function detectNarrator(text: string): NarratorId | null {
    const normalized = text.toLowerCase();
    for (const [candidate, aliases] of Object.entries(NARRATOR_ALIASES) as [
      NarratorId,
      string[],
    ][]) {
      if (aliases.some((alias) => normalized.includes(alias))) return candidate;
    }
    return null;
  }

  function includesAny(text: string, words: string[]): boolean {
    const normalized = text.toLowerCase();
    return words.some((word) => normalized.includes(word));
  }

  function selectNarratorFromCard(id: NarratorId) {
    setAgentPrompt(
      `Voice-only mode is active. Please say "${narratorDisplayName(
        id
      )}" and let the agent choose via tool call.`
    );
  }

  useEffect(() => {
    pendingNarratorRef.current = pendingNarrator;
  }, [pendingNarrator]);

  async function handleStartVoice() {
    setHasStartedVoice(true);
    setAgentPrompt("Connecting... once ready, hold the talk button and say Fox, Owl, or Bear.");
    const startAgentId = activeAgentId ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    if (!startAgentId) {
      setAgentPrompt(
        "Missing default agent ID. Set NEXT_PUBLIC_ELEVENLABS_AGENT_ID or narrator-specific IDs."
      );
      return;
    }
    await connect(startAgentId);
    sendUserMessage(
      "Ask the child to choose exactly one narrator: Fiona the Fox, Oliver the Owl, or Bruno the Bear. When decided, call tool select_narrator with { narrator: 'fox'|'owl'|'bear' }."
    );
  }

  const handleStopVoice = useCallback(async () => {
    await disconnect();
    setAgentPrompt("Voice onboarding stopped. You can restart anytime.");
  }, [disconnect]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Meta" && isConnected) {
        startTalking();
      }
      if (event.key === "Alt" && (isConnected || isConnecting)) {
        void handleStopVoice();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Meta") {
        stopTalking();
      }
    };

    const onWindowBlur = () => {
      stopTalking();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [handleStopVoice, isConnected, isConnecting, startTalking, stopTalking]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 to-indigo-100 px-6 py-12">
      <div className="w-full max-w-2xl space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-indigo-900">
            educ-ATE
          </h1>
          <p className="text-lg text-indigo-600">
            Talk to the onboarding agent. It will select your narrator by tool call.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-indigo-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
            Voice Onboarding
          </h2>
          <p className="text-sm text-gray-700">{agentPrompt}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleStartVoice}
              disabled={isConnecting || isConnected}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Start Voice Onboarding"}
            </button>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              <span className="font-semibold">Controls:</span> Hold <kbd className="rounded border px-1 py-0.5">Cmd</kbd> to talk, press <kbd className="rounded border px-1 py-0.5">Option</kbd> to stop.
            </p>
            <p>
              <span className="font-semibold">You said:</span> {lastUserTranscript || "..."}
            </p>
            <p>
              <span className="font-semibold">Agent said:</span> {lastAgentTranscript || "..."}
            </p>
            <p>
              <span className="font-semibold">Pending narrator:</span>{" "}
              {pendingNarrator ? narratorDisplayName(pendingNarrator) : "none"}
            </p>
            {error ? (
              <p className="text-red-600">
                <span className="font-semibold">Error:</span> {error}
              </p>
            ) : null}
            {!hasStartedVoice ? (
              <p className="text-gray-500">
                Voice not started yet. Press Start Voice Onboarding.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Narrators (voice-selected)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {NARRATORS.map((n) => (
              <button
                key={n.id}
                onClick={() => selectNarratorFromCard(n.id)}
                type="button"
                className={`rounded-2xl border-2 p-5 text-center transition-all ${
                  narrator === n.id
                    ? "border-indigo-500 bg-indigo-50 shadow-lg scale-[1.02]"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                <span className="text-5xl">{n.emoji}</span>
                <p className="mt-2 text-sm font-semibold text-gray-800">{n.name}</p>
                <p className="mt-1 text-[11px] text-gray-500">voice picks this</p>
              </button>
            ))}
          </div>
        </div>

        {selectedNarrator ? (
          <p className="text-center text-sm font-semibold text-indigo-700">
            Selected narrator: {selectedNarrator.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
