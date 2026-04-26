"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type NarratorId = "record" | "fox" | "sloth" | "grandma";

interface LandingChatProps {
  selected: NarratorId;
  setSelected: (id: NarratorId) => void;
}

export function LandingChat({ selected, setSelected }: LandingChatProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);

  const selectedRef = useRef<NarratorId>(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const conversation = useConversation({
    onError: (err) => {
      console.error("[LandingChat] Error:", err);
      setError("Something went wrong. Try refreshing.");
    },
  });

  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

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
        clientTools: {
          selectNarrator: async ({ narrator }: { narrator: string }) => {
            const valid: NarratorId[] = ["record", "fox", "sloth", "grandma"];
            if (valid.includes(narrator as NarratorId)) {
              setSelected(narrator as NarratorId);
              return `Selected ${narrator}`;
            }
            return `Unknown narrator ${narrator}`;
          },
          startStory: async ({ topic }: { topic: string }) => {
            const params = new URLSearchParams({
              topic,
              narrator: selectedRef.current,
              demo: "1",
            });
            router.push(`/story?${params.toString()}`);
            return `Starting ${topic}`;
          },
          createNewStory: async () => {
            router.push(`/new-story?narrator=${selectedRef.current}`);
            return "Opening new story flow";
          },
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
  }, [router, setSelected]);

  const endSession = useCallback(async () => {
    if (conversationRef.current.status !== "connected") return;
    try {
      await conversationRef.current.endSession();
    } catch {
      // Ignore teardown errors to avoid noisy unhandled rejections.
    }
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Command key starts the mic session, Option key ends it.
      if (e.metaKey) {
        void startSession();
      } else if (e.altKey) {
        void endSession();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
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
          Press Command to open mic, Option to close
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
