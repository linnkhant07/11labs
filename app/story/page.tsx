"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getReadingOrder, type Story, type Page } from "../lib/stories";

const PLACEHOLDER_GRADIENTS = [
  "from-sky-300 to-cyan-500",
  "from-slate-400 to-zinc-600",
  "from-amber-300 to-orange-500",
  "from-emerald-300 to-teal-500",
  "from-violet-300 to-purple-500",
  "from-rose-300 to-pink-500",
];

function getGradient(index: number) {
  return PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
}

export default function StoryPage() {
  const searchParams = useSearchParams();
  const narratorId = searchParams.get("narrator") ?? "mouse";
  const topic = searchParams.get("topic") ?? "tornadoes";

  const [story, setStory] = useState<Story | null>(null);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [branchChoices, setBranchChoices] = useState<Record<string, "a" | "b">>({});
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch story from /api/generate
  useEffect(() => {
    let cancelled = false;

    async function generate() {
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, narrator: narratorId }),
        });

        if (!res.ok) throw new Error("Failed to generate story");

        const data: Story = await res.json();
        if (!cancelled) setStory(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [topic, narratorId]);

  const pages = useMemo(
    () => (story ? getReadingOrder(story.pages, branchChoices) : []),
    [branchChoices, story]
  );
  const currentPage: Page | undefined = pages[pageIndex];
  const isLastPage = pageIndex === pages.length - 1 && !currentPage?.choice;
  const needsChoice = currentPage?.choice && !branchChoices[currentPage.page_id];

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  async function handleSpeak() {
    if (playing) {
      stopAudio();
      return;
    }
    if (!currentPage) return;

    // If we have a pre-generated audio_url (base64), use it directly
    if (currentPage.audio_url) {
      setPlaying(true);
      const audio = new Audio(currentPage.audio_url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        audioRef.current = null;
      };
      await audio.play();
      return;
    }

    // Fallback: call /api/speak on-demand
    setLoading(true);
    setPlaying(true);

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentPage.narration, narrator: narratorId }),
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlaying(false);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    stopAudio();
    setPageIndex((i) => Math.min(i + 1, pages.length - 1));
  }

  function handlePrev() {
    stopAudio();
    setPageIndex((i) => Math.max(i - 1, 0));
  }

  function handleChoice(option: "a" | "b") {
    if (!currentPage) return;
    stopAudio();
    setBranchChoices((prev) => ({ ...prev, [currentPage.page_id]: option }));
    setPageIndex((i) => i + 1);
  }

  function handleRestart() {
    stopAudio();
    setBranchChoices({});
    setPageIndex(0);
  }

  const narratorLabel =
    narratorId === "mouse" ? "\ud83d\udc2d Milo" : narratorId === "owl" ? "\ud83e\udd89 Oliver" : "\ud83d\udc30 Rosie";

  // Loading state
  if (generating) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-indigo-50">
        <div className="text-center space-y-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-lg font-semibold text-indigo-800">
            {narratorLabel} is creating your story about {topic}...
          </p>
          <p className="text-sm text-indigo-400">
            Generating story and narration audio — this may take a moment
          </p>
        </div>
      </div>
    );
  }

  if (error || !story || !currentPage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-indigo-50">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-red-600">
            {error ?? "Something went wrong"}
          </p>
          <a
            href="/"
            className="inline-block rounded-full bg-indigo-500 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-600"
          >
            Try Again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-50 to-indigo-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-indigo-900">{story.title}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-indigo-500">
          <span>Narrated by {narratorLabel}</span>
          <span className="text-indigo-300">|</span>
          <span>
            Page {pageIndex + 1} of {pages.length}
            {needsChoice ? "+" : ""}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-4xl space-y-6">
          {/* Illustration */}
          <div className={`relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-inner ${
            !currentPage.image_url ? `bg-gradient-to-br ${getGradient(pageIndex)} flex items-center justify-center` : ""
          }`}>
            {currentPage.image_url ? (
              <img
                src={currentPage.image_url}
                alt={currentPage.image_prompt}
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,white_0%,transparent_60%)]" />
                <p className="text-white/70 text-sm font-medium px-8 text-center italic">
                  {currentPage.image_prompt}
                </p>
              </>
            )}
          </div>

          {/* Narration text */}
          <div className="rounded-2xl bg-white p-6 md:p-8 shadow-sm border border-indigo-100">
            <p className="text-lg leading-relaxed text-gray-700">
              {currentPage.narration}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* Prev */}
            <button
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                pageIndex === 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              &larr; Back
            </button>

            {/* Play / Stop */}
            <button
              onClick={handleSpeak}
              disabled={loading && !playing}
              className={`rounded-full px-8 py-3 text-sm font-bold transition-all shadow-md ${
                playing
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg"
              }`}
            >
              {loading && !playing ? "Loading..." : playing ? "Stop" : "\u25b6  Read Aloud"}
            </button>

            {/* Next / Choice / Restart */}
            {needsChoice ? (
              <div className="text-sm text-indigo-400 font-medium">Make a choice &darr;</div>
            ) : isLastPage ? (
              <button
                onClick={handleRestart}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                Restart
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                Next &rarr;
              </button>
            )}
          </div>

          {/* Choice UI */}
          {needsChoice && currentPage.choice && (
            <div className="rounded-2xl bg-indigo-50 border-2 border-indigo-200 p-6 space-y-4">
              <p className="text-center font-semibold text-indigo-800">
                {currentPage.choice.question}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleChoice("a")}
                  className="rounded-xl bg-white border-2 border-indigo-200 p-4 text-center font-medium text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50 transition-all hover:shadow-md"
                >
                  {currentPage.choice.option_a.label}
                </button>
                <button
                  onClick={() => handleChoice("b")}
                  className="rounded-xl bg-white border-2 border-indigo-200 p-4 text-center font-medium text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50 transition-all hover:shadow-md"
                >
                  {currentPage.choice.option_b.label}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
