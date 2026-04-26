"use client";

import { useConversation } from "@elevenlabs/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNarrator } from "./narrator-context";
import type { NarratorId } from "../lib/narrators";

const BAR_COUNT = 32;
const IDLE_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = (i - BAR_COUNT / 2) / (BAR_COUNT / 2);
  return 0.18 + 0.12 * Math.exp(-t * t * 2);
});

export function WaveformChat() {
  const router = useRouter();
  const { setNarrator, setLibraryId } = useNarrator();
  const [error, setError] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>(IDLE_HEIGHTS);
  const rafRef = useRef<number | null>(null);
  const startedByHotkeyRef = useRef(false);
  const hotkeyHeldRef = useRef(false);
  const sessionSeqRef = useRef(0);
  const activeSessionRef = useRef<number | null>(null);

  const getMessageText = (msg: unknown) => {
    if (!msg || typeof msg !== "object") return "";
    const m = msg as Record<string, unknown>;
    if (typeof m.text === "string") return m.text;
    if (typeof m.transcript === "string") return m.transcript;
    if (typeof m.message === "string") return m.message;
    const source = m.source;
    if (source && typeof source === "object") {
      const s = source as Record<string, unknown>;
      if (typeof s.text === "string") return s.text;
      if (typeof s.transcript === "string") return s.transcript;
      if (typeof s.message === "string") return s.message;
    }
    return "";
  };

  const conversation = useConversation({
    onAgentToolRequest: (event) => {
      const sid = activeSessionRef.current ?? -1;
      console.log(`[WaveformChat][S${sid}] tool request`, event);
    },
    onAgentToolResponse: (event) => {
      const sid = activeSessionRef.current ?? -1;
      console.log(`[WaveformChat][S${sid}] tool response`, event);
    },
    onConnect: () => {
      const sid = activeSessionRef.current ?? -1;
      console.log(`[WaveformChat][S${sid}] connected`);
      if (startedByHotkeyRef.current && !hotkeyHeldRef.current) {
        console.log(`[WaveformChat][S${sid}] hotkey released during connect; ending`);
        void conversation.endSession();
      }
    },
    onDisconnect: (reason) => {
      const sid = activeSessionRef.current ?? -1;
      console.log(`[WaveformChat][S${sid}] disconnected`, { reason });
      activeSessionRef.current = null;
    },
    onMessage: (msg) => {
      const sid = activeSessionRef.current ?? -1;
      const text = getMessageText(msg);
      console.log(`[WaveformChat][S${sid}] message`, {
        raw: msg,
        textPreview: text ? text.slice(0, 240) : "",
      });
    },
    onError: (err) => {
      const sid = activeSessionRef.current ?? -1;
      console.error(`[WaveformChat][S${sid}] Error:`, err);
      setError("Something went wrong. Try again!");
    },
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  useEffect(() => {
    if (!isConnected) {
      setBars(IDLE_HEIGHTS);
      return;
    }

    const tick = () => {
      const input = conversation.getInputVolume?.() ?? 0;
      const output = conversation.getOutputVolume?.() ?? 0;
      const vol = Math.max(input, output * 1.4);
      const now = Date.now() / 140;

      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const center = 1 - Math.abs((i - BAR_COUNT / 2) / (BAR_COUNT / 2));
        const wave = (Math.sin(now + i * 0.55) + Math.sin(now * 1.3 + i * 0.31)) * 0.25 + 0.5;
        const noise = Math.random() * 0.08;
        const h = 0.18 + vol * 1.6 * wave * (0.55 + 0.45 * center) + noise;
        return Math.min(1, Math.max(0.12, h));
      });
      setBars(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isConnected, conversation]);

  const startChat = useCallback(async (startedByHotkey = false) => {
    setError(null);
    startedByHotkeyRef.current = startedByHotkey;
    const sid = ++sessionSeqRef.current;
    activeSessionRef.current = sid;
    console.log(`[WaveformChat][S${sid}] start requested`, {
      trigger: startedByHotkey ? "hotkey" : "button",
    });
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log(`[WaveformChat][S${sid}] microphone permission ok`);
      const res = await fetch("/api/get-signed-url");
      console.log(`[WaveformChat][S${sid}] signed-url response`, { status: res.status });
      const data = await res.json();
      console.log(`[WaveformChat][S${sid}] signed-url payload`, {
        hasSignedUrl: Boolean(data?.signedUrl),
        role: data?.role ?? null,
        agentId: data?.agentId ?? null,
      });
      if (!data.signedUrl) throw new Error("No signed URL returned");

      // Client tools must match the dashboard's client-tool list exactly.
      // Per the dashboard config:
      //   select_character (client) -> echo character
      //   select_mode      (client) -> echo mode
      //   start_story      (client) -> navigate, return "ok" (1s timeout)
      //   transfer_to_agent (system, NOT client) -> the platform handles it.
      // Do NOT register transfer_to_agent here — it collides with the built-in
      // system tool and prevents the session from starting.
      const log = (name: string, params: unknown, result: unknown) =>
        console.log(`[tool] ${name}`, { params, result });

      const charToNarrator = (raw: string): NarratorId => {
        const v = String(raw ?? "").trim().toLowerCase();
        if (v.includes("fox") || v.includes("finn")) return "fox";
        if (v.includes("sloth") || v.includes("sally")) return "sloth";
        if (v.includes("grandma") || v.includes("owl")) return "sloth";
        return "fox";
      };

      const topicToLibraryId = (raw: string): string | null => {
        const v = String(raw ?? "").trim().toLowerCase();
        if (v.includes("tornado")) return "tornadoes";
        if (v.includes("rain")) return "rainforests";
        if (v.includes("titanic")) return "titanic";
        return null;
      };

      const resolveSubject = (raw: unknown): "Science" | "History" => {
        const v = String(raw ?? "").trim().toLowerCase();
        if (!v) return "Science";
        const scienceHints = [
          "science",
          "plants",
          "animals",
          "space",
          "weather",
          "tornadoes",
          "robots",
          "dinosaurs",
          "experiments",
          "nature",
          "plant one",
        ];
        const historyHints = [
          "history",
          "the past",
          "ancient times",
          "kings",
          "queens",
          "castles",
          "presidents",
          "civilizations",
          "egypt",
          "rome",
          "building one",
          "history one",
        ];
        if (historyHints.some((hint) => v.includes(hint))) return "History";
        if (scienceHints.some((hint) => v.includes(hint))) return "Science";
        return v === "history" ? "History" : "Science";
      };

      const clientTools = {
        select_character: (params: Record<string, unknown>) => {
          const result = String(params.character ?? "");
          // Update narrator context so the landing page highlights the avatar
          // and unlocks the library.
          setNarrator(charToNarrator(result));
          log("select_character", params, result);
          return result; // "fox" | "sloth" | "grandma"
        },
        select_mode: (params: Record<string, unknown>) => {
          const result = String(params.mode ?? "");
          // Highlight the matching library card, then navigate for create mode.
          // explore_library stays on the landing page until start_story reveals
          // the topic (no dedicated /library route exists).
          if (result === "create_new_story") {
            setLibraryId("create");
            router.push("/new-story");
          } else {
            setLibraryId(null);
          }
          log("select_mode", params, result);
          return result; // "create_new_story" | "explore_library"
        },
        select_subject: (params: Record<string, unknown>) => {
          const raw =
            params.subject ??
            params.choice ??
            params.value ??
            params.topic ??
            params.query ??
            params.transcript;
          const result = resolveSubject(raw);
          log("select_subject", params, result);
          return result; // "Science" | "History"
        },
        start_story: (params: Record<string, unknown>) => {
          const mode = String(params.mode ?? "explore_library");
          const topic = String(params.topic ?? "");
          const character = String(params.character ?? "");
          const narrator = charToNarrator(character);
          // Light up the matching library card right before navigation so the
          // child sees what's selected even if the page transition is fast.
          if (mode === "create_new_story") setLibraryId("create");
          else setLibraryId(topicToLibraryId(topic));
          const route =
            mode === "create_new_story"
              ? `/new-story?topic=${encodeURIComponent(topic)}&narrator=${narrator}`
              : `/story?topic=${encodeURIComponent(topic)}&narrator=${narrator}`;
          log("start_story", params, { route });
          // Fire-and-forget navigation. start_story has a 1s response timeout —
          // do NOT await /api/generate here; the destination page handles that.
          router.push(route);
          return "ok";
        },
      };

      await conversation.startSession({ signedUrl: data.signedUrl, clientTools });
      console.log(`[WaveformChat][S${sid}] startSession resolved`);
    } catch (err) {
      console.error(`[WaveformChat][S${sid}] Failed to start:`, err);
      setError(err instanceof Error ? err.message : "Could not start. Check your microphone!");
    }
  }, [conversation, router, setNarrator, setLibraryId]);

  const stopChat = useCallback(async () => {
    startedByHotkeyRef.current = false;
    const sid = activeSessionRef.current ?? -1;
    console.log(`[WaveformChat][S${sid}] stop requested`);
    await conversation.endSession();
  }, [conversation]);

  useEffect(() => {
    const isModifier = (e: KeyboardEvent) =>
      e.key === "Meta" || e.key === "Alt" || e.code === "MetaLeft" || e.code === "MetaRight" || e.code === "AltLeft" || e.code === "AltRight";

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isModifier(e) || e.repeat) return;
      hotkeyHeldRef.current = true;
      if (isConnected || isConnecting) return;
      void startChat(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isModifier(e)) return;
      hotkeyHeldRef.current = false;
      if (!startedByHotkeyRef.current) return;
      // If still connecting, onConnect handler will close immediately.
      if (!isConnected) return;
      void stopChat();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isConnected, isConnecting, startChat, stopChat]);

  const statusLabel = isConnecting
    ? "Connecting…"
    : isConnected
      ? conversation.isSpeaking
        ? "Talking…"
        : "Listening…"
      : "Hold ⌘ or ⌥ to talk";

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={() => (isConnected ? stopChat() : startChat(false))}
        disabled={isConnecting}
        aria-label={isConnected ? "Stop conversation" : "Start conversation"}
        className={`group relative flex h-[180px] w-[320px] items-center justify-center gap-[3px] rounded-[36px] px-8 transition-all duration-200 focus:outline-none ${
          isConnected
            ? "bg-white shadow-[2px_2px_24px_rgba(242,147,55,0.45)] ring-2 ring-[#f29337]"
            : isConnecting
              ? "bg-white/80 shadow-[2px_2px_20px_rgba(0,0,0,0.1)] cursor-wait"
              : "bg-white shadow-[2px_2px_20px_rgba(0,0,0,0.1)] hover:scale-[1.02] hover:shadow-[2px_2px_24px_rgba(242,147,55,0.35)]"
        }`}
      >
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[4px] rounded-full transition-[height] duration-75 ease-out"
            style={{
              height: `${Math.round(h * 130)}px`,
              backgroundColor: "#f29337",
              opacity: isConnecting ? 0.4 : isConnected ? 1 : 0.75,
            }}
          />
        ))}
        {isConnected && (
          <span className="pointer-events-none absolute inset-0 rounded-[36px] ring-1 ring-[#f29337]/30 animate-pulse" />
        )}
      </button>

      <p
        className="text-[18px] text-[#a05a1f]"
        style={{ fontFamily: "var(--font-abeezee), sans-serif" }}
      >
        {statusLabel}
      </p>

      {error && (
        <div className="max-w-xs rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow">
          {error}
        </div>
      )}
    </div>
  );
}
