"use client";

import { useConversation } from "@elevenlabs/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

interface NarratorChatProps {
  narratorId: string;
  voiceId: string;
  topic: string;
  currentNarration: string;
  narratorName: string;
  onChatStatusChange?: (active: boolean) => void;
}

export type NarratorChatHandle = {
  toggle: () => void;
};

const NARRATOR_PROMPTS: Record<string, string> = {
  fox:
    "You are Finn the Fox, a curious and excitable narrator. You speak quickly with enthusiasm, love fun facts, and use phrases like 'Oh wow!' and 'Did you know?!'",
  sloth:
    "You are Sally the Sloth, a warm and gentle narrator. You're patient and encouraging, love asking questions to help kids think, and use phrases like 'Great question!' and 'Let's figure this out together!'",
  grandma:
    "You are Grandma, a wise and calm narrator. You explain things clearly and thoughtfully, love connecting ideas, and use phrases like 'Interesting observation!' and 'Here's something fascinating...'",
  custom:
    "You are a warm, friendly narrator. You explain things clearly to a child, love fun facts, and stay encouraging and curious throughout.",
  // Legacy aliases (older callers may pass mouse/rabbit/owl).
  mouse:
    "You are Milo the Mouse, a curious and excitable narrator. You speak quickly with enthusiasm, love fun facts, and use phrases like 'Oh wow!' and 'Did you know?!'",
  rabbit:
    "You are Rosie the Rabbit, a warm and gentle narrator. You're patient and encouraging, love asking questions to help kids think, and use phrases like 'Great question!' and 'Let's figure this out together!'",
  owl:
    "You are Oliver the Owl, a wise and calm narrator. You explain things clearly and thoughtfully, love connecting ideas, and use phrases like 'Interesting observation!' and 'Here's something fascinating...'",
};

export const NarratorChat = forwardRef<NarratorChatHandle, NarratorChatProps>(
  function NarratorChat(
    { narratorId, voiceId, topic, currentNarration, narratorName, onChatStatusChange },
    ref,
  ) {
    const [error, setError] = useState<string | null>(null);

    const conversation = useConversation({
      onConnect: () => onChatStatusChange?.(true),
      onDisconnect: () => onChatStatusChange?.(false),
      onError: (err) => {
        console.error("[NarratorChat] Error:", err);
        setError("Something went wrong. Try again!");
      },
    });

    const conversationRef = useRef(conversation);
    conversationRef.current = conversation;

    const isConnected = conversation.status === "connected";

    const startChat = useCallback(async () => {
      if (conversationRef.current.status === "connected") return;
      setError(null);
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const res = await fetch("/api/get-signed-url");
        const data = await res.json();
        if (!data.signedUrl) throw new Error("No signed URL returned");

        await conversationRef.current.startSession({
          signedUrl: data.signedUrl,
          overrides: {
            agent: {
              prompt: {
                prompt: `${NARRATOR_PROMPTS[narratorId] ?? NARRATOR_PROMPTS.fox}

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
    }, [narratorId, voiceId, topic, currentNarration, narratorName]);

    const stopChat = useCallback(async () => {
      if (conversationRef.current.status !== "connected") return;
      try {
        await conversationRef.current.endSession();
      } catch {
        // Ignore teardown errors.
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        toggle: () => {
          if (conversationRef.current.status === "connected") void stopChat();
          else void startChat();
        },
      }),
      [startChat, stopChat],
    );

    // Push-to-talk: hold Command to keep the mic open, release to disconnect.
    useEffect(() => {
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Meta" && !e.repeat) void startChat();
      }
      function onKeyUp(e: KeyboardEvent) {
        if (e.key === "Meta") void stopChat();
      }
      function onBlur() {
        void stopChat();
      }
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
      };
    }, [startChat, stopChat]);

    return (
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {error && (
          <div className="pointer-events-auto max-w-xs rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg">
            {error}
          </div>
        )}

        {isConnected && (
          <div className="pointer-events-auto rounded-xl border border-orange-200 bg-white/90 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur">
            {conversation.isSpeaking ? (
              <span className="flex items-center gap-2 text-[#f09237]">
                <span className="flex gap-0.5">
                  <span className="h-3 w-1 animate-bounce rounded-full bg-[#f09237]" style={{ animationDelay: "0ms" }} />
                  <span className="h-4 w-1 animate-bounce rounded-full bg-[#f09237]" style={{ animationDelay: "150ms" }} />
                  <span className="h-3 w-1 animate-bounce rounded-full bg-[#f09237]" style={{ animationDelay: "300ms" }} />
                </span>
                {narratorName} is talking...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-green-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Listening...
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
