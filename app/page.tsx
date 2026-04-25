"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useConversationalPtt,
  type ClientToolDeclaration,
} from "./lib/useConversationalPtt";

const NARRATORS = [
  { id: "fox", emoji: "\ud83e\udd8a", name: "Finn the Fox", color: "from-orange-400 to-amber-500" },
  { id: "owl", emoji: "\ud83e\udd89", name: "Oliver the Owl", color: "from-indigo-400 to-purple-500" },
] as const;

type NarratorId = (typeof NARRATORS)[number]["id"];
type OnboardingStep = "character" | "ready";
type CloneState = "idle" | "recording" | "uploading" | "success" | "error";

const MIN_RECORD_SECONDS = 3;
const MIN_RECORD_BYTES = 4_000;

const CHARACTER_ALIASES: Record<NarratorId, string[]> = {
  fox: ["fox", "finn", "finn fox", "finn the fox", "fiona", "fiona fox"],
  owl: ["owl", "oliver", "oliver owl", "oliver the owl"],
};

const CLIENT_TOOLS: ClientToolDeclaration[] = [
  {
    name: "select_character",
    description:
      "Call this when the user names the narrator they want. The character must be one of: Finn the Fox or Oliver the Owl. Always call this tool when the user picks — never just acknowledge verbally.",
    parameters: {
      type: "object",
      properties: {
        character: {
          type: "string",
          description:
            "The name the user said. Accepts variations like 'fox', 'finn', 'finn the fox', 'owl', 'oliver'.",
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
  const [step, setStep] = useState<OnboardingStep>("character");
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

  useEffect(() => {
    const saved = localStorage.getItem("clonedVoiceId");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; lazy init would hydration-mismatch under SSR.
    if (saved) setClonedVoiceId(saved);
  }, []);

  const selectedNarrator = useMemo(
    () => NARRATORS.find((n) => n.id === narrator) ?? null,
    [narrator]
  );
  const beginStory = useCallback(
    (chosenNarrator: NarratorId) => {
      router.push(`/story?narrator=${chosenNarrator}`);
    },
    [router]
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

  const {
    connect,
    connectForNarrator,
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
              "Invalid character. Expected one of Finn the Fox or Oliver the Owl.",
            isError: true,
          };
        }

        void pushTerminalDebug("character_mapped", `${characterValue} -> ${characterId}`);
        setNarrator(characterId);
        setStep("ready");
        setAgentPrompt(
          `${narratorDisplayName(characterId)} selected. Transferring to ${narratorDisplayName(characterId)}...`
        );

        queueMicrotask(async () => {
          try {
            await disconnect();
            void pushTerminalDebug("transfer_disconnected", "onboarding_agent");
            await connectForNarrator(characterId);
            void pushTerminalDebug("transfer_connected", `narrator=${characterId}`);
            void pushTerminalDebug("navigation_handoff", `/story?narrator=${characterId}`);
            beginStory(characterId);
          } catch (transferError) {
            const message =
              transferError instanceof Error
                ? transferError.message
                : "Failed to transfer to narrator agent.";
            void pushTerminalDebug("transfer_failed", message);
          }
        });

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

  function selectNarratorFromCard(id: NarratorId) {
    setAgentPrompt(
      `Voice-only mode is active. Please say "${narratorDisplayName(
        id
      )}" and let the agent choose via tool call.`
    );
  }

  async function handleStartVoice() {
    setHasStartedVoice(true);
    setStep("character");
    setNarrator(null);
    setAgentPrompt(
      "Connecting... once ready, hold Cmd and speak. Agent should call select_character."
    );
    void pushTerminalDebug("voice_start_requested");
    const startAgentId = activeAgentId ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    if (!startAgentId) {
      void pushTerminalDebug("missing_default_agent_id");
      setAgentPrompt(
        "Missing default agent ID. Set NEXT_PUBLIC_ELEVENLABS_AGENT_ID or narrator-specific IDs."
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
              <span className="font-semibold">Step:</span> {step}
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
            Characters
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

        {selectedNarrator ? (
          <p className="text-center text-sm font-semibold text-indigo-700">
            Selected narrator: {selectedNarrator.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
