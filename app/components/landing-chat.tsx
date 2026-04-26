"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNarrator } from "./narrator-context";
import { isNarratorId } from "../lib/narrators";

type NarratorId = "record" | "fox" | "sloth" | "grandma";

interface LandingChatProps {
  selected: NarratorId | null;
  setSelected: (id: NarratorId) => void;
}

export function LandingChat({ selected, setSelected }: LandingChatProps) {
  const { setNarrator } = useNarrator();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);

  const selectedRef = useRef<NarratorId | null>(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const conversation = useConversation({
    onError: (err) => {
      console.error("[LandingChat] Error:", err);
      setError("Something went wrong. Try refreshing.");
    },
    onAgentToolRequest: (event) => {
      console.log("[LandingChat] onAgentToolRequest:", event);
    },
    onAgentToolResponse: (event) => {
      console.log("[LandingChat] onAgentToolResponse:", event);
    },
  });

  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const selectNarratorTool = useCallback(
    (params: Record<string, unknown>) => {
      const raw = params.narrator ?? params.character ?? params.name ?? params.value;
      const input = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      const aliasToId: Record<string, NarratorId> = {
        fox: "fox",
        "finn the fox": "fox",
        sloth: "sloth",
        "sally the sloth": "sloth",
        grandma: "grandma",
        record: "record",
        "record a voice": "record",
      };
      const resolved = aliasToId[input];

      console.log("[LandingChat][tool] select_character called with:", {
        params,
        resolved,
      });

      if (resolved) {
        setSelected(resolved);
        if (isNarratorId(resolved)) setNarrator(resolved);
        console.log("[LandingChat][tool] select_character success:", { resolved });
        return `Selected ${resolved}`;
      }

      console.warn("[LandingChat][tool] select_character unknown narrator:", { params });
      return "Unknown narrator. Please choose fox, sloth, grandma, or record.";
    },
    [setNarrator, setSelected]
  );

  const startStoryTool = useCallback(
    ({ topic }: { topic: string }) => {
      console.log("[LandingChat][tool] start_story called with:", {
        topic,
        selectedNarrator: selectedRef.current,
      });
      if (!selectedRef.current) {
        console.warn("[LandingChat][tool] start_story blocked: no narrator selected");
        return "No narrator selected. Ask the user to choose a narrator first.";
      }
      const params = new URLSearchParams({
        topic,
        narrator: selectedRef.current,
        demo: "1",
      });
      console.log("[LandingChat][tool] start_story navigating:", {
        path: `/story?${params.toString()}`,
      });
      router.push(`/story?${params.toString()}`);
      return `Starting ${topic}`;
    },
    [router]
  );

  const createNewStoryTool = useCallback(() => {
    console.log("[LandingChat][tool] create_new_story called with:", {
      selectedNarrator: selectedRef.current,
    });
    if (!selectedRef.current) {
      console.warn("[LandingChat][tool] create_new_story blocked: no narrator selected");
      return "No narrator selected. Ask the user to choose a narrator first.";
    }
    console.log("[LandingChat][tool] create_new_story navigating:", {
      path: `/new-story?narrator=${selectedRef.current}`,
    });
    router.push(`/new-story?narrator=${selectedRef.current}`);
    return "Opening new story flow";
  }, [router]);

  const exploreLibraryTool = useCallback(
    (params: Record<string, unknown>) => {
      const rawTopic = params.topic ?? params.title ?? params.story ?? params.query;
      const topic =
        typeof rawTopic === "string" && rawTopic.trim()
          ? rawTopic.trim()
          : "What are Tornadoes?";

      console.log("[LandingChat][tool] explore_library called with:", {
        params,
        resolvedTopic: topic,
        selectedNarrator: selectedRef.current,
      });

      if (!selectedRef.current) {
        console.warn("[LandingChat][tool] explore_library blocked: no narrator selected");
        return "No narrator selected. Ask the user to choose a narrator first.";
      }

      const routeTopic =
        topic.toLowerCase() === "what are tornadoes?" ? "What are Tornadoes?" : topic;
      const query = new URLSearchParams({
        topic: routeTopic,
        narrator: selectedRef.current,
        demo: "1",
      });

      console.log("[LandingChat][tool] explore_library navigating:", {
        path: `/story?${query.toString()}`,
      });
      router.push(`/story?${query.toString()}`);
      return `Opening library story: ${routeTopic}`;
    },
    [router]
  );

  const selectModeTool = useCallback(
    (params: Record<string, unknown>) => {
      const raw = params.mode ?? params.choice ?? params.intent ?? params.value;
      const input = typeof raw === "string" ? raw.trim().toLowerCase() : "";

      console.log("[LandingChat][tool] select_mode called with:", { params, input });

      if (
        input === "create a new story" ||
        input === "create_new_story" ||
        input === "create" ||
        input === "new story"
      ) {
        return createNewStoryTool();
      }

      if (
        input === "what are tornadoes?" ||
        input === "what are tornadoes" ||
        input === "explore_library" ||
        input === "explore"
      ) {
        return exploreLibraryTool({ topic: "What are Tornadoes?" });
      }

      console.warn("[LandingChat][tool] select_mode unknown mode:", { params });
      return "Unknown mode. Please choose Create a New Story or What are Tornadoes?.";
    },
    [createNewStoryTool, exploreLibraryTool]
  );

  const selectSubjectTool = useCallback((params: Record<string, unknown>) => {
    const raw =
      params.subject ??
      params.choice ??
      params.topic ??
      params.query ??
      params.value ??
      params.transcript;
    const input = typeof raw === "string" ? raw.trim().toLowerCase() : "";

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
      "how the world works",
      "plant one",
      "left card",
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
      "right card",
    ];

    const containsAny = (hints: string[]) => hints.some((hint) => input.includes(hint));
    const resolved = containsAny(scienceHints)
      ? "Science"
      : containsAny(historyHints)
        ? "History"
        : null;

    console.log("[LandingChat][tool] select_subject called with:", { params, input, resolved });

    if (resolved) return resolved;

    console.warn("[LandingChat][tool] select_subject unknown subject:", { params });
    return "Science";
  }, []);

  const startSession = useCallback(async () => {
    if (conversationRef.current.status === "connected" || isStartingRef.current) return;

    setError(null);
    isStartingRef.current = true;
    setIsStarting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch("/api/get-signed-url");
      const data = await res.json();
      if (!data.signedUrl) throw new Error("No signed URL returned");

      await conversationRef.current.startSession({
        signedUrl: data.signedUrl,
        // Pass explicit tools at session start as a fallback to avoid timing races.
        clientTools: {
          selectNarrator: selectNarratorTool,
          select_character: selectNarratorTool,
          startStory: startStoryTool,
          start_story: startStoryTool,
          createNewStory: createNewStoryTool,
          create_new_story: createNewStoryTool,
          explore_library: exploreLibraryTool,
          select_mode: selectModeTool,
          select_subject: selectSubjectTool,
        },
      });
    } catch (err) {
      console.error("[LandingChat] Failed to start:", err);
      setError(
        err instanceof Error ? err.message : "Could not start. Check your microphone!"
      );
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [
    createNewStoryTool,
    exploreLibraryTool,
    selectModeTool,
    selectSubjectTool,
    selectNarratorTool,
    startStoryTool,
  ]);

  const endSession = useCallback(async () => {
    if (conversationRef.current.status !== "connected") return;
    try {
      await conversationRef.current.endSession();
    } catch {
      // Ignore teardown errors to avoid noisy unhandled rejections.
    }
  }, []);

  useEffect(() => {
    // Push-to-talk: hold Command to keep the mic open, release to disconnect.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Meta" && !e.repeat) void startSession();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Meta") void endSession();
    }
    function onBlur() {
      void endSession();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [startSession, endSession]);

  useEffect(() => {
    return () => {
      void (async () => {
        try {
          await conversationRef.current.endSession();
        } catch {
          // Ignore teardown errors on unmount.
        }
      })();
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {error && (
        <div className="max-w-xs rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg">
          {error}
        </div>
      )}

      {isConnected && (
        <div className="rounded-xl border border-orange-200 bg-white/90 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur">
          {conversation.isSpeaking ? (
            <span className="flex items-center gap-2 text-[#f09237]">
              <span className="flex gap-0.5">
                <span
                  className="h-3 w-1 animate-bounce rounded-full bg-[#f09237]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-4 w-1 animate-bounce rounded-full bg-[#f09237]"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-3 w-1 animate-bounce rounded-full bg-[#f09237]"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
              Guide is talking...
            </span>
          ) : (
            <span className="flex items-center gap-2 text-green-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Listening...
            </span>
          )}
        </div>
      )}

      {isConnecting && !isConnected && (
        <div className="rounded-lg border border-gray-100 bg-white/80 px-3 py-1.5 text-xs text-gray-500 shadow backdrop-blur">
          Waking up guide...
        </div>
      )}
      {!isConnected && !isConnecting && (
        <div className="rounded-lg border border-gray-100 bg-white/80 px-3 py-1.5 text-xs text-gray-500 shadow backdrop-blur">
          Hold Command to talk
        </div>
      )}

      {/* Visible mic indicator */}
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition-all ${
          isConnected
            ? "bg-[#f09237] ring-4 ring-orange-200"
            : isConnecting
              ? "bg-gray-300"
              : "bg-gray-200"
        }`}
        aria-label={isConnected ? "Guide is listening" : "Connecting to guide"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </div>
    </div>
  );
}
