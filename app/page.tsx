"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useConversationalPtt,
  type ClientToolDeclaration,
} from "./lib/useConversationalPtt";

const NARRATORS = [
  { id: "mouse", emoji: "🐭", name: "Milo the Mouse" },
  { id: "rabbit", emoji: "🐰", name: "Rosie the Rabbit" },
  { id: "owl", emoji: "🦉", name: "Oliver the Owl" },
] as const;

const SUGGESTED_TOPICS = [
  { emoji: "🌪️", name: "Tornadoes" },
  { emoji: "🚧", name: "Pyramids" },
  { emoji: "🌋", name: "Volcanoes" },
  { emoji: "🦖", name: "Dinosaurs" },
  { emoji: "🚀", name: "Space" },
  { emoji: "🌊", name: "Ocean" },
];

type NarratorId = (typeof NARRATORS)[number]["id"];
type CloneState = "idle" | "recording" | "uploading" | "success" | "error";

const MIN_RECORD_SECONDS = 3;
const MIN_RECORD_BYTES = 4_000;

const CHARACTER_ALIASES: Record<NarratorId, string[]> = {
  mouse: ["mouse", "milo"],
  rabbit: ["rabbit", "rosie", "bunny"],
  owl: ["owl", "oliver"],
};

const CLIENT_TOOLS: ClientToolDeclaration[] = [
  {
    name: "select_character",
    description:
      "Call this when the user names the narrator they want. The character must be one of: Milo the Mouse, Rosie the Rabbit, or Oliver the Owl. Always call this tool when the user picks — never just acknowledge verbally.",
    parameters: {
      type: "object",
      properties: {
        character: {
          type: "string",
          description:
            "The name the user said. Accepts variations like 'mouse', 'milo', 'rabbit', 'rosie', 'bunny', 'owl', 'oliver'.",
        },
      },
      required: ["character"],
    },
    expects_response: true,
  },
];

export default function Home() {
  const router = useRouter();

  const [narrator, setNarrator] = useState<NarratorId | null>(null);
  const [topic, setTopic] = useState("");
  const [demoMode, setDemoMode] = useState(true);

  const [agentPrompt, setAgentPrompt] = useState(
    "Press Start Voice Onboarding so I can help you choose a narrator."
  );
  const [hasStartedVoice, setHasStartedVoice] = useState(false);
  const [activeAgentId] = useState<string | undefined>(
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID
  );

  const [cloneState, setCloneState] = useState<CloneState>("idle");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const topicRef = useRef(topic);
  const demoModeRef = useRef(demoMode);
  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);
  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);

  useEffect(() => {
    const saved = localStorage.getItem("clonedVoiceId");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; lazy init would hydration-mismatch under SSR.
    if (saved) setClonedVoiceId(saved);
  }, []);

  const selectedNarrator = useMemo(
    () => NARRATORS.find((n) => n.id === narrator) ?? null,
    [narrator]
  );

  const narratorDisplayName = useCallback((id: NarratorId): string => {
    return NARRATORS.find((n) => n.id === id)?.name ?? id;
  }, []);

  const pushTerminalDebug = useCallback(async (event: string, detail?: string) => {
    await fetch("/api/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        detail,
        ts: new Date().toISOString(),
      }),
    }).catch(() => {
      // Ignore debug transport failures.
    });
  }, []);

  function detectCharacter(value: string): NarratorId | null {
    const normalized = value.toLowerCase();
    for (const [candidate, aliases] of Object.entries(CHARACTER_ALIASES) as [
      NarratorId,
      string[],
    ][]) {
      if (aliases.some((alias) => normalized.includes(alias))) return candidate;
    }
    return null;
  }

  const navigateToStory = useCallback(
    (chosenNarrator: NarratorId, chosenTopic: string) => {
      const params = new URLSearchParams({
        topic: chosenTopic.trim(),
        narrator: chosenNarrator,
        ...(demoModeRef.current ? { demo: "1" } : {}),
      });
      router.push(`/story?${params.toString()}`);
    },
    [router]
  );

  function handleStart() {
    if (!narrator || !topic.trim()) return;
    navigateToStory(narrator, topic);
  }

  const {
    connect,
    disconnect,
    startTalking,
    stopTalking,
    isConnected,
    isConnecting,
    error,
    lastUserTranscript,
    lastAgentTranscript,
  } = useConversationalPtt({
    agentId: activeAgentId,
    inputGain: 2.5,
    clientTools: CLIENT_TOOLS,
    voiceIdOverride: clonedVoiceId ?? undefined,
    onSocketEvent: ({ type, detail }) => {
      void pushTerminalDebug(type, detail);
    },
    onToolCall: async ({ toolName, parameters }) => {
      void pushTerminalDebug("tool_call_received", `${toolName} ${JSON.stringify(parameters)}`);
      if (toolName === "select_character") {
        const characterValue =
          typeof parameters.character === "string" ? parameters.character : "";
        const characterId = detectCharacter(characterValue);
        if (!characterId) {
          void pushTerminalDebug("character_mapping_failed", characterValue || "(empty)");
          return {
            result:
              "Invalid character. Expected one of Milo the Mouse, Rosie the Rabbit, or Oliver the Owl.",
            isError: true,
          };
        }

        void pushTerminalDebug("character_mapped", `${characterValue} -> ${characterId}`);
        setNarrator(characterId);

        const currentTopic = topicRef.current.trim();
        if (currentTopic) {
          setAgentPrompt(`${narratorDisplayName(characterId)} selected. Starting story...`);
          queueMicrotask(() => {
            void pushTerminalDebug(
              "navigation_handoff",
              `/story?narrator=${characterId}&topic=${currentTopic}`
            );
            navigateToStory(characterId, currentTopic);
          });
        } else {
          setAgentPrompt(
            `${narratorDisplayName(characterId)} selected. Pick a topic to start your adventure.`
          );
        }

        return { result: `Character selected: ${characterId}` };
      }
      void pushTerminalDebug("unknown_tool", toolName);
      return { result: `Unknown tool ${toolName}`, isError: true };
    },
  });

  const startCloneCapture = useCallback(async () => {
    if (cloneState === "recording" || cloneState === "uploading") return;
    setCloneError(null);
    setRecordSeconds(0);

    if (isConnected || isConnecting) {
      void pushTerminalDebug("clone_pre_disconnect", "freeing_mic_for_recorder");
      await disconnect();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      recordChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };

      recorder.start();
      setCloneState("recording");
      recordStartRef.current = Date.now();
      void pushTerminalDebug("clone_record_start");

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((Date.now() - recordStartRef.current) / 1000);
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mic access failed.";
      setCloneState("error");
      setCloneError(message);
      void pushTerminalDebug("clone_record_error", message);
    }
  }, [cloneState, disconnect, isConnected, isConnecting, pushTerminalDebug]);

  const stopCloneCapture = useCallback(async () => {
    if (cloneState !== "recording") return;

    if (recordTimerRef.current != null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      await stopped;
    }

    recordStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordStreamRef.current = null;
    recorderRef.current = null;

    const elapsed = (Date.now() - recordStartRef.current) / 1000;
    const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
    recordChunksRef.current = [];

    void pushTerminalDebug(
      "clone_record_stop",
      `elapsed=${elapsed.toFixed(2)}s bytes=${blob.size}`
    );

    if (elapsed < MIN_RECORD_SECONDS || blob.size < MIN_RECORD_BYTES) {
      setCloneState("error");
      setCloneError(`Hold longer next time — at least ${MIN_RECORD_SECONDS}s.`);
      return;
    }

    setCloneState("uploading");
    setAgentPrompt("Cloning your buddy's voice...");

    try {
      const formData = new FormData();
      formData.append("audio", blob, "buddy.webm");
      formData.append("name", `study-buddy-${Date.now()}`);

      const response = await fetch("/api/clone-voice", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        voiceId?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !payload.voiceId) {
        throw new Error(payload.error || payload.detail || "Clone failed");
      }

      localStorage.setItem("clonedVoiceId", payload.voiceId);
      localStorage.setItem("clonedVoiceCreatedAt", new Date().toISOString());
      setClonedVoiceId(payload.voiceId);
      setCloneState("success");
      setAgentPrompt("Buddy cloned! Reconnecting agent with new voice...");
      void pushTerminalDebug("clone_upload_ok", payload.voiceId);

      queueMicrotask(async () => {
        try {
          await disconnect();
          if (activeAgentId) {
            await connect(activeAgentId);
            void pushTerminalDebug("clone_voice_swap", `voice=${payload.voiceId}`);
            setAgentPrompt(
              "Reconnected with cloned voice. Hold Cmd and speak — agent should reply in your buddy's voice."
            );
          }
        } catch (swapError) {
          const message =
            swapError instanceof Error ? swapError.message : "Voice swap failed.";
          void pushTerminalDebug("clone_voice_swap_failed", message);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Clone request failed.";
      setCloneState("error");
      setCloneError(message);
      void pushTerminalDebug("clone_upload_error", message);
    }
  }, [activeAgentId, cloneState, connect, disconnect, pushTerminalDebug]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current != null) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      recordStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordStreamRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Ignore — recorder may have already stopped.
        }
      }
      recorderRef.current = null;
    };
  }, []);

  async function handleStartVoice() {
    setHasStartedVoice(true);
    setAgentPrompt(
      "Connecting... once ready, hold Cmd and speak. Agent should call select_character."
    );
    void pushTerminalDebug("voice_start_requested");
    const startAgentId = activeAgentId ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    if (!startAgentId) {
      void pushTerminalDebug("missing_default_agent_id");
      setAgentPrompt(
        "Missing default agent ID. Set NEXT_PUBLIC_ELEVENLABS_AGENT_ID."
      );
      return;
    }
    await connect(startAgentId);
    void pushTerminalDebug("connected", startAgentId);
  }

  const handleStopVoice = useCallback(async () => {
    void pushTerminalDebug("voice_stop_requested");
    await disconnect();
    setAgentPrompt("Voice onboarding stopped. You can restart anytime.");
  }, [disconnect, pushTerminalDebug]);

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
            Pick a topic and a narrator — or talk to the onboarding agent and let it choose.
          </p>
        </div>

        {/* Topic input */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            What do you want to learn about?
          </h2>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Type anything... tornadoes, dinosaurs, black holes..."
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-lg text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-indigo-400 focus:shadow-md"
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t.name}
                onClick={() => setTopic(t.name)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                  topic === t.name
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                }`}
              >
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Onboarding panel */}
        <div className="space-y-4 rounded-2xl border border-indigo-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
            Voice Onboarding (optional)
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
              <span className="font-semibold">Controls:</span> Hold{" "}
              <kbd className="rounded border px-1 py-0.5">Cmd</kbd> to talk, press{" "}
              <kbd className="rounded border px-1 py-0.5">Option</kbd> to stop.
            </p>
            <p>
              <span className="font-semibold">You said:</span> {lastUserTranscript || "..."}
            </p>
            <p>
              <span className="font-semibold">Agent said:</span> {lastAgentTranscript || "..."}
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

        {/* Narrator grid + Clone-your-buddy */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Choose your narrator
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {NARRATORS.map((n) => (
              <button
                key={n.id}
                onClick={() => setNarrator(n.id)}
                type="button"
                className={`rounded-2xl border-2 p-5 text-center transition-all ${
                  narrator === n.id
                    ? "border-indigo-500 bg-indigo-50 shadow-lg scale-[1.02]"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                <span className="text-5xl">{n.emoji}</span>
                <p className="mt-2 text-sm font-semibold text-gray-800">{n.name}</p>
              </button>
            ))}

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                void startCloneCapture();
              }}
              onPointerUp={() => void stopCloneCapture()}
              onPointerLeave={() => {
                if (cloneState === "recording") void stopCloneCapture();
              }}
              onPointerCancel={() => {
                if (cloneState === "recording") void stopCloneCapture();
              }}
              disabled={cloneState === "uploading"}
              className={`rounded-2xl border-2 p-5 text-center transition-all touch-none select-none ${
                cloneState === "recording"
                  ? "border-rose-500 bg-rose-50 shadow-lg scale-[1.02]"
                  : cloneState === "success"
                  ? "border-emerald-500 bg-emerald-50"
                  : cloneState === "error"
                  ? "border-amber-500 bg-amber-50"
                  : clonedVoiceId
                  ? "border-emerald-300 bg-white hover:border-emerald-400 hover:shadow-md"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
              }`}
            >
              <span className="text-5xl">
                {cloneState === "recording"
                  ? "🔴"
                  : cloneState === "uploading"
                  ? "⏳"
                  : cloneState === "success"
                  ? "✨"
                  : "🎤"}
              </span>
              <p className="mt-2 text-sm font-semibold text-gray-800">Clone your buddy</p>
              <p className="mt-1 text-[11px] text-gray-500">
                {cloneState === "idle" &&
                  (clonedVoiceId ? "buddy ready — hold to re-clone" : "hold + play voice on phone")}
                {cloneState === "recording" && `recording ${recordSeconds.toFixed(1)}s...`}
                {cloneState === "uploading" && "cloning..."}
                {cloneState === "success" && "cloned ✓"}
                {cloneState === "error" && (cloneError ?? "try again")}
              </p>
            </button>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!narrator || !topic.trim()}
          className={`w-full rounded-full py-4 text-lg font-bold transition-all ${
            narrator && topic.trim()
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.01]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Your Adventure
          {selectedNarrator ? ` with ${selectedNarrator.name}` : ""}
        </button>

        {/* Demo mode toggle */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              demoMode ? "bg-indigo-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                demoMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-500">
            {demoMode ? "Demo mode (hardcoded, no credits)" : "Live mode (Gemini generation)"}
          </span>
        </div>
      </div>
    </div>
  );
}
