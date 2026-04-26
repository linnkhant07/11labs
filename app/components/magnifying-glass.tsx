"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface MagnifyingGlassProps {
  imageUrl: string;
  topic: string;
  narration: string;
  voiceId: string;
}

interface DropPoint {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export function MagnifyingGlass({
  imageUrl,
  topic,
  narration,
  voiceId,
}: MagnifyingGlassProps) {
  const [position, setPosition] = useState<DropPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<DropPoint | null>(null);
  const [bubble, setBubble] = useState<"ask" | "thinking" | "result" | null>(null);
  const [explanation, setExplanation] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset when page changes
  useEffect(() => {
    setPosition(null);
    setDragging(false);
    setDragPos(null);
    setBubble(null);
    setExplanation("");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [imageUrl, narration]);

  const getRelativePosition = useCallback(
    (clientX: number, clientY: number): DropPoint | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return null;
      return { x, y };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      const pos = getRelativePosition(e.clientX, e.clientY);
      if (pos) setDragPos(pos);
    },
    [getRelativePosition]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pos = getRelativePosition(e.clientX, e.clientY);
      if (pos) setDragPos(pos);
    },
    [dragging, getRelativePosition]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragging(false);
      const pos = getRelativePosition(e.clientX, e.clientY);
      if (pos) {
        setPosition(pos);
        setDragPos(null);
        setBubble("ask");
        setExplanation("");
      }
    },
    [dragging, getRelativePosition]
  );

  const handleExplain = useCallback(async () => {
    if (!position) return;
    setBubble("thinking");

    try {
      const res = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          x: position.x,
          y: position.y,
          topic,
          narration,
        }),
      });
      const data = await res.json();
      const cleaned = (data.explanation ?? "").replace(/\*{1,3}(.*?)\*{1,3}/g, "$1");
      setExplanation(cleaned);
      setBubble("result");

      // Speak the explanation
      const audioRes = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned, voiceId }),
      });
      const blob = await audioRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setExplanation("Oops! I couldn't figure that out. Try again!");
      setBubble("result");
    }
  }, [position, imageUrl, topic, narration, voiceId]);

  const handleDismiss = useCallback(() => {
    setPosition(null);
    setBubble(null);
    setExplanation("");
    setDragPos(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // Current display position of the magnifying glass
  const displayPos = dragging && dragPos ? dragPos : position;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Magnifying glass icon — in corner when idle, follows pointer when dragging */}
      <div
        onPointerDown={handlePointerDown}
        className={`absolute z-20 cursor-grab active:cursor-grabbing select-none transition-transform ${
          dragging ? "scale-125" : "hover:scale-110"
        }`}
        style={
          displayPos
            ? {
                left: `${displayPos.x}%`,
                top: `${displayPos.y}%`,
                transform: "translate(-50%, -50%)",
              }
            : {
                left: "16px",
                bottom: "16px",
                top: "auto",
              }
        }
      >
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-white/90 shadow-lg border-2 border-indigo-300 backdrop-blur">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* "What's this?" bubble at drop point */}
      {position && bubble === "ask" && (
        <div
          className="absolute z-30"
          style={{
            left: `${position.x}%`,
            top: `${Math.max(position.y - 12, 2)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <button
            onClick={handleExplain}
            className="rounded-xl bg-white shadow-lg border-2 border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-all whitespace-nowrap"
          >
            {"🔍"} What&apos;s this?
          </button>
        </div>
      )}

      {/* Thinking bubble */}
      {position && bubble === "thinking" && (
        <div
          className="absolute z-30"
          style={{
            left: `${position.x}%`,
            top: `${Math.max(position.y - 12, 2)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="rounded-xl bg-white shadow-lg border-2 border-indigo-200 px-4 py-2 text-sm text-indigo-500 flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
            Thinking...
          </div>
        </div>
      )}

      {/* Result bubble */}
      {position && bubble === "result" && (
        <div
          className="absolute z-30 w-72"
          style={{
            left: `clamp(10%, ${position.x}%, 70%)`,
            top: `${Math.max(position.y - 15, 2)}%`,
          }}
          onClick={handleDismiss}
        >
          <div className="rounded-xl bg-white shadow-lg border-2 border-indigo-200 p-3 cursor-pointer hover:bg-gray-50 transition-all">
            <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
            <p className="text-xs text-gray-400 mt-1">Tap to dismiss</p>
          </div>
        </div>
      )}

      {/* Dismiss overlay when bubble is showing */}
      {position && bubble === "result" && (
        <div
          className="absolute inset-0 z-20"
          onClick={handleDismiss}
        />
      )}
    </div>
  );
}
