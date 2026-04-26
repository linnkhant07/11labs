"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNarrator } from "./narrator-context";

type CategoryId = "science" | "history";

const CATEGORY_ALIASES: Record<string, CategoryId> = {
  science: "science",
  "the science": "science",
  "science card": "science",
  "left card": "science",
  history: "history",
  "the history": "history",
  "history card": "history",
  "right card": "history",
};

export function NewStoryChat() {
  const router = useRouter();
  const { voiceId, narratorId, info: narrator } = useNarrator();
  const [error, setError] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const preserveSessionOnUnmountRef = useRef(false);

  const conversation = useConversation({
    onError: (err) => {
      console.error("[NewStoryChat] Error:", err);
      setError("Something went wrong. Try refreshing.");
    },
    onConnect: (e) => console.log("[NewStoryChat] onConnect:", e),
    onDisconnect: (e) => console.log("[NewStoryChat] onDisconnect:", e),
    onModeChange: (e) => console.log("[NewStoryChat] onModeChange:", e),
    onConversationMetadata: (e) => console.log("[NewStoryChat] onConversationMetadata:", e),
    onMessage: (e) => console.log("[NewStoryChat] onMessage:", e),
    onAgentToolRequest: (event) => {
      const name = (event as { tool_name?: string })?.tool_name;
      if (name === "transfer_to_agent") {
        console.log("[NewStoryChat][TRANSFER] transfer_to_agent requested:", event);
      } else {
        console.log("[NewStoryChat] onAgentToolRequest:", event);
      }
    },
    onAgentToolResponse: (event) => {
      const name = (event as { tool_name?: string })?.tool_name;
      if (name === "transfer_to_agent") {
        console.log("[NewStoryChat][TRANSFER] transfer_to_agent response:", event);
      } else {
        console.log("[NewStoryChat] onAgentToolResponse:", event);
      }
    },
    onDebug: (e) => console.log("[NewStoryChat] onDebug:", e),
  });

  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const selectCategoryTool = useCallback(
    (params: Record<string, unknown>) => {
      const raw =
        params.category ?? params.choice ?? params.value ?? params.subject;
      const input = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      const resolved = CATEGORY_ALIASES[input];
      if (!resolved) {
        return "Unknown category. Please choose Science or History.";
      }
      const qs = new URLSearchParams({
        narrator: narratorId,
        category: resolved,
      });
      // Preserve the live session across the route transition to topic selection.
      preserveSessionOnUnmountRef.current = true;
      router.push(`/new-story/topic?${qs.toString()}`);
      return `Opening ${resolved}`;
    },
    [router, narratorId]
  );

  const goBackTool = useCallback(() => {
    router.push("/");
    return "Going back to the home page.";
  }, [router]);

  const startSession = useCallback(async () => {
    if (
      conversationRef.current.status === "connected" ||
      isStartingRef.current
    )
      return;

    setError(null);
    isStartingRef.current = true;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch("/api/get-signed-url");
      const data = await res.json();
      if (!data.signedUrl) throw new Error("No signed URL returned");

      await conversationRef.current.startSession({
        signedUrl: data.signedUrl,
        overrides: {
          tts: { voiceId },
          agent: {
            firstMessage: `Hi! I'm ${narrator.name}. What kind of stuff do you want to learn about — Science, or History?`,
          },
        },
        clientTools: {
          select_category: selectCategoryTool,
          selectCategory: selectCategoryTool,
          select_subject: selectCategoryTool,
          go_back: goBackTool,
        },
      });
    } catch (err) {
      console.error("[NewStoryChat] Failed to start:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not start. Check your microphone!"
      );
    } finally {
      isStartingRef.current = false;
    }
  }, [voiceId, narrator.name, selectCategoryTool, goBackTool]);

  const endSession = useCallback(async () => {
    if (conversationRef.current.status !== "connected") return;
    try {
      await conversationRef.current.endSession();
    } catch {
      // Ignore teardown errors.
    }
  }, []);

  useEffect(() => {
    // Keyboard shortcuts: Command starts the session, Option ends it.
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey) void startSession();
      else if (e.altKey) void endSession();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [startSession, endSession]);

  useEffect(() => {
    return () => {
      if (preserveSessionOnUnmountRef.current) {
        return;
      }
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
              {narrator.short} is talking...
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
          Waking up {narrator.short}...
        </div>
      )}
      {!isConnected && !isConnecting && (
        <div className="rounded-lg border border-gray-100 bg-white/80 px-3 py-1.5 text-xs text-gray-500 shadow backdrop-blur">
          Press Command to open mic, Option to close
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (isConnected) void endSession();
          else void startSession();
        }}
        disabled={isConnecting}
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition-all ${
          isConnected
            ? "bg-[#f09237] ring-4 ring-orange-200"
            : isConnecting
              ? "bg-gray-300"
              : "bg-gray-200 hover:bg-gray-300"
        }`}
        aria-label={isConnected ? "Stop the guide" : "Start the guide"}
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
      </button>
    </div>
  );
}
