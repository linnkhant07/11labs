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
  fox:
    "You are Finn the Fox, a curious and excitable narrator. You speak quickly with enthusiasm, love fun facts, and use phrases like 'Oh wow!' and 'Did you know?!'",
  sloth:
    "You are Sally the Sloth, a warm and gentle narrator. You're patient and encouraging, love asking questions to help kids think, and use phrases like 'Great question!' and 'Let's figure this out together!'",
  custom:
    "You are a friendly story narrator using a custom-cloned voice. Be warm, clear, and encouraging. Stay focused on the story.",
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

      // Route to the narrator agent (Finn the Fox), not the concierge.
      const res = await fetch("/api/get-signed-url?role=narrator");
      const data = await res.json();
      if (!data.signedUrl) throw new Error("No signed URL returned");
      console.log("[NarratorChat] starting session", {
        narratorId,
        voiceId,
        narratorName,
      });

      // Register every client tool the narrator agent can invoke. Missing a
      // name here will throw "Client tool with name X is not defined on
      // client" and kill the session as soon as the agent tries to call it.
      const log = (name: string, params: unknown, result: unknown) =>
        console.log(`[NarratorChat][tool] ${name}`, { params, result });

      const clientTools = {
        select_subject: (params: Record<string, unknown>) => {
          const result = String(params.subject ?? "");
          log("select_subject", params, result);
          return result;
        },
      };

      await conversation.startSession({
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
        clientTools,
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
        <div className="rounded-xl bg-white/90 backdrop-blur px-4 py-2 text-sm font-medium shadow-lg border border-[#fee8d3]">
          {conversation.isSpeaking ? (
            <span className="text-[#f09237] flex items-center gap-2">
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-[#f09237] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-4 bg-[#f09237] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-3 bg-[#f09237] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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

      {/* Hidden trigger button for the "Talk to" header button */}
      <button
        data-narrator-chat-trigger
        onClick={isConnected ? stopChat : startChat}
        disabled={isConnecting}
        className="sr-only"
        aria-label={isConnected ? "Stop chat" : `Talk to ${narratorName}`}
      />
    </div>
  );
}
