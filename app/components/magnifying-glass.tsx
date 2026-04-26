"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface MagnifyingGlassProps {
  imageUrl: string;
  topic: string;
  narration: string;
  narrator: string;
}

interface DropPoint {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export function MagnifyingGlass({
  imageUrl,
  topic,
  narration,
  narrator,
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
      setExplanation(data.explanation);
      setBubble("result");

      // Speak the explanation
      const audioRes = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.explanation, narrator }),
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
  }, [position, imageUrl, topic, narration, narrator]);

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

  // Convert a percentage-based position to fixed screen coordinates
  const toFixed = (pct: DropPoint) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    return {
      x: r.left + (pct.x / 100) * r.width,
      y: r.top + (pct.y / 100) * r.height,
    };
  };

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
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[#f09237] shadow-lg shadow-[#f09237]/30 backdrop-blur">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white"
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

      {/* "What's this?" bubble */}
      {position && bubble === "ask" && createPortal(
        <div
          className="fixed z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ left: toFixed(position).x, top: toFixed(position).y - 8 }}
        >
          <button
            onClick={handleExplain}
            className="rounded-xl bg-white shadow-lg border-2 border-[#f09237] px-4 py-2 font-grandstander text-[13px] font-semibold text-[#f09237] hover:bg-[#fef5ea] transition-all whitespace-nowrap"
          >
            {"🔍"} What&apos;s this?
          </button>
        </div>,
        document.body
      )}

      {/* Thinking bubble */}
      {position && bubble === "thinking" && createPortal(
        <div
          className="fixed z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ left: toFixed(position).x, top: toFixed(position).y - 8 }}
        >
          <div className="rounded-xl bg-white shadow-lg border-2 border-[#fee8d3] px-4 py-2 font-grandstander text-[13px] text-[#f09237] flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#fee8d3] border-t-[#f09237]" />
            Thinking...
          </div>
        </div>,
        document.body
      )}

      {/* Result bubble */}
      {position && bubble === "result" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={handleDismiss}
          />
          <div
            className="fixed z-[9999] w-72 -translate-x-1/2 -translate-y-full cursor-pointer"
            style={{ left: toFixed(position).x, top: toFixed(position).y - 8 }}
            onClick={handleDismiss}
          >
            <div className="rounded-xl bg-white shadow-lg border-2 border-[#fee8d3] p-3 hover:bg-[#fef5ea] transition-all">
              <p className="text-[13px] leading-relaxed text-[#585858]" style={{ fontFamily: "var(--font-abeezee), sans-serif" }}>{explanation.replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")}</p>
              <p className="font-grandstander text-[11px] text-[#c4a882] mt-1">Tap to dismiss</p>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
