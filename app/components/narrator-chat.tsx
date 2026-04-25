"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";

interface NarratorChatProps {
  narratorId: string;
  voiceId: string;
  topic: string;
  currentNarration: string;
  narratorName: string;
  onChatStatusChange?: (active: boolean) => void;
}

const NARRATOR_PROMPTS: Record<string, string> = {
  mouse:
    "You are Milo the Mouse, a curious and excitable narrator. You speak quickly with enthusiasm, love fun facts, and use phrases like 'Oh wow!' and 'Did you know?!'",
  rabbit:
    "You are Rosie the Rabbit, a warm and gentle narrator. You're patient and encouraging, love asking questions to help kids think, and use phrases like 'Great question!' and 'Let's figure this out together!'",
  owl:
    "You are Oliver the Owl, a wise and calm narrator. You explain things clearly and thoughtfully, love connecting ideas, and use phrases like 'Interesting observation!' and 'Here's something fascinating...'",
};

export function NarratorChat({
  narratorId,
  voiceId,
  topic,
  currentNarration,
  narratorName,
  onChatStatusChange,
}: NarratorChatProps) {
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => onChatStatusChange?.(true),
    onDisconnect: () => onChatStatusChange?.(false),
    onError: (err) => {
      console.error("[NarratorChat] Error:", err);
      setError("Something went wrong. Try again!");
    },
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const startChat = useCallback(async () => {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch("/api/get-signed-url");
      const data = await res.json();
      if (!data.signedUrl) throw new Error("No signed URL returned");

      await conversation.startSession({
        signedUrl: data.signedUrl,
        overrides: {
          agent: {
            prompt: {
              prompt: `${NARRATOR_PROMPTS[narratorId] ?? NARRATOR_PROMPTS.mouse}

You are narrating an educational story about "${topic}" for a child aged 6-12 with ADHD.

The child is currently on this part of the story:
"${currentNarration}"

Rules:
- Answer questions about the story and topic in 2-3 short sentences
- Use real educational facts — never make things up
- Stay in character as ${narratorName}
- If the kid goes off-topic, gently bring them back to the story
- Be enthusiastic and encouraging`,
            },
          },
          tts: { voiceId },
        },
      });
    } catch (err) {
      console.error("[NarratorChat] Failed to start:", err);
      setError(err instanceof Error ? err.message : "Could not start. Check your microphone!");
    }
  }, [conversation, narratorId, voiceId, topic, currentNarration, narratorName]);

  const stopChat = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {error && (
        <div className="max-w-xs rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 shadow-lg">
          {error}
        </div>
      )}

      {isConnected && (
        <div className="rounded-xl bg-white/90 backdrop-blur px-4 py-2 text-sm font-medium shadow-lg border border-indigo-100">
          {conversation.isSpeaking ? (
            <span className="text-indigo-700 flex items-center gap-2">
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-4 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              {narratorName} is talking...
            </span>
          ) : (
            <span className="text-green-700 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Listening... ask a question!
            </span>
          )}
        </div>
      )}

      {!isConnected && !isConnecting && (
        <div className="rounded-lg bg-white/80 backdrop-blur px-3 py-1.5 text-xs text-gray-500 shadow border border-gray-100">
          Ask {narratorName}
        </div>
      )}

      <button
        onClick={isConnected ? stopChat : startChat}
        disabled={isConnecting}
        className={`relative h-16 w-16 rounded-full shadow-xl transition-all duration-200 flex items-center justify-center ${
          isConnected
            ? "bg-red-500 hover:bg-red-600 text-white scale-110 ring-4 ring-red-200"
            : isConnecting
              ? "bg-gray-300 text-gray-500 cursor-wait"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:shadow-2xl hover:scale-110 ring-4 ring-indigo-200/50"
        }`}
        title={isConnected ? "Tap to stop" : `Tap to ask ${narratorName} a question`}
      >
        {isConnecting ? (
          <span className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
        ) : isConnected ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
        {isConnected && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20" />
        )}
      </button>
    </div>
  );
}
