"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getReadingOrder, TORNADO_STORY, PYRAMIDS_STORY, type Story, type Page } from "../lib/stories";
import { NarratorChat } from "../components/narrator-chat";
import { MagnifyingGlass } from "../components/magnifying-glass";

const PLACEHOLDER_GRADIENTS = [
  "from-sky-300 to-cyan-500",
  "from-slate-400 to-zinc-600",
  "from-amber-300 to-orange-500",
  "from-emerald-300 to-teal-500",
  "from-violet-300 to-purple-500",
  "from-rose-300 to-pink-500",
];

const VOICE_IDS: Record<string, string> = {
  mouse: "dfZGXKiIzjizWtJ0NgPy",
  rabbit: "vGQNBgLaiM3EdZtxIiuY",
  owl: "XsmrVB66q3D4TaXVaWNF",
};

const NARRATOR_NAMES: Record<string, string> = {
  mouse: "Milo the Mouse",
  rabbit: "Rosie the Rabbit",
  owl: "Oliver the Owl",
};

const NARRATOR_LABELS: Record<string, string> = {
  mouse: "\ud83d\udc2d Milo",
  rabbit: "\ud83d\udc30 Rosie",
  owl: "\ud83e\udd89 Oliver",
};

const INACTIVITY_TIMEOUT = 30_000;

const RE_ENGAGEMENT_PROMPTS = [
  "Hey! Are you still with me? Want me to read that part again?",
  "Still there? I was just thinking about something cool related to our story!",
  "Hey friend! Did that last part make you curious about anything?",
  "I'm still here! Want to keep going, or do you have a question?",
  "Psst! Don't forget, you can ask me anything about the story!",
];

function getGradient(index: number) {
  return PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
}

export default function StoryPage() {
  const searchParams = useSearchParams();
  const narratorId = searchParams.get("narrator") ?? "mouse";
  const topic = searchParams.get("topic") ?? "tornadoes";
  const isDemo = searchParams.get("demo") === "1";
  const customVoiceId = searchParams.get("voiceId");

  const demoStory: Story | null = isDemo
    ? {
        ...(topic.toLowerCase().includes("pyramid") ? PYRAMIDS_STORY : TORNADO_STORY),
        narrator: { type: "animal", character: narratorId as "mouse" | "rabbit" | "owl", voice_id: "" },
      }
    : null;

  const [story, setStory] = useState<Story | null>(demoStory);
  const [generating, setGenerating] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [branchChoices, setBranchChoices] = useState<Record<string, "a" | "b">>({});
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasFinishedReading, setHasFinishedReading] = useState(false);
  const [nudgeText, setNudgeText] = useState<string | null>(null);
  const [chatActive, setChatActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeCount = useRef(0);

  const narratorLabel = narratorId === "custom" ? "🎙️ Your Voice" : (NARRATOR_LABELS[narratorId] ?? NARRATOR_LABELS.mouse);
  const narratorName = narratorId === "custom" ? "Your narrator" : (NARRATOR_NAMES[narratorId] ?? NARRATOR_NAMES.mouse);
  const voiceId = customVoiceId ?? VOICE_IDS[narratorId] ?? VOICE_IDS.mouse;

  // --- Story generation ---
  useEffect(() => {
    if (isDemo) return;
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

  // --- Audio playback ---
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  const playNarration = useCallback(async (page: Page) => {
    stopAudio();
    setHasFinishedReading(false);

    if (page.audio_url) {
      setPlaying(true);
      const audio = new Audio(page.audio_url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); setHasFinishedReading(true); audioRef.current = null; };
      await audio.play();
      return;
    }

    // Fallback: on-demand TTS
    setLoading(true);
    setPlaying(true);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: page.narration, narrator: narratorId, voiceId }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        setHasFinishedReading(true);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }, [stopAudio, narratorId, voiceId]);

  function handleSpeak() {
    if (playing) { stopAudio(); return; }
    if (currentPage) playNarration(currentPage);
  }

  // --- Auto-narrate when page changes ---
  useEffect(() => {
    if (!currentPage || generating) return;
    setHasFinishedReading(false);

    // Delay slightly to let React strict mode cleanup run first
    const timeout = setTimeout(() => {
      playNarration(currentPage);
    }, 50);

    return () => {
      clearTimeout(timeout);
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage?.page_id, generating]);

  // --- Stop narration when chat starts ---
  const handleChatStatusChange = useCallback((active: boolean) => {
    setChatActive(active);
    if (active) stopAudio();
  }, [stopAudio]);

  // --- Inactivity re-engagement ---
  const resetInactivityTimer = useCallback(() => {
    setNudgeText(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      const prompt = RE_ENGAGEMENT_PROMPTS[nudgeCount.current % RE_ENGAGEMENT_PROMPTS.length];
      nudgeCount.current += 1;
      setNudgeText(prompt);
      fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, narrator: narratorId, voiceId }),
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.play();
        })
        .catch(() => {});
    }, INACTIVITY_TIMEOUT);
  }, [narratorId]);

  useEffect(() => {
    if (generating || !story) return;
    resetInactivityTimer();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [pageIndex, branchChoices, playing, generating, story, resetInactivityTimer]);

  useEffect(() => {
    if (generating || !story) return;
    const reset = () => resetInactivityTimer();
    window.addEventListener("click", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("touchstart", reset);
    return () => {
      window.removeEventListener("click", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("touchstart", reset);
    };
  }, [generating, story, resetInactivityTimer]);

  // --- Navigation ---
  function handleNext() { stopAudio(); setHasFinishedReading(false); setPageIndex((i) => Math.min(i + 1, pages.length - 1)); }
  function handlePrev() { stopAudio(); setHasFinishedReading(false); setPageIndex((i) => Math.max(i - 1, 0)); }

  function handleChoice(option: "a" | "b") {
    if (!currentPage) return;
    stopAudio();
    setHasFinishedReading(false);
    setBranchChoices((prev) => ({ ...prev, [currentPage.page_id]: option }));
    setPageIndex((i) => i + 1);
  }

  function handleRestart() { stopAudio(); setHasFinishedReading(false); setBranchChoices({}); setPageIndex(0); }

  // --- Render ---
  if (generating) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-indigo-50">
        <div className="text-center space-y-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-lg font-semibold text-indigo-800">
            {narratorLabel} is creating your story about {topic}...
          </p>
          <p className="text-sm text-indigo-400">Generating story and narration audio</p>
        </div>
      </div>
    );
  }

  if (error || !story || !currentPage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-indigo-50">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-red-600">{error ?? "Something went wrong"}</p>
          <a href="/" className="inline-block rounded-full bg-indigo-500 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-600">
            Try Again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-50 to-indigo-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur border-b border-indigo-100">
        <span className="text-sm font-bold text-indigo-900">{story.title}</span>
        <div className="flex items-center gap-4 text-sm text-indigo-500">
          <span>Narrated by {narratorLabel}</span>
          <span className="text-indigo-300">|</span>
          <span>Page {pageIndex + 1} of {pages.length}{needsChoice ? "+" : ""}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-4xl space-y-6">
          {/* Illustration */}
          <div className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-inner">
            {currentPage.image_url ? (
              <>
                <img
                  src={currentPage.image_url}
                  alt={currentPage.image_prompt}
                  className="h-full w-full object-cover"
                />
                <MagnifyingGlass
                  imageUrl={currentPage.image_url}
                  topic={topic}
                  narration={currentPage.narration}
                  narrator={narratorId}
                />
              </>
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${getGradient(pageIndex)} flex items-center justify-center`}>
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,white_0%,transparent_60%)]" />
                <p className="text-white/70 text-sm font-medium px-8 text-center italic">
                  {currentPage.image_prompt}
                </p>
              </div>
            )}
          </div>

          {/* Narration text */}
          <div className="rounded-2xl bg-white p-6 md:p-8 shadow-sm border border-indigo-100">
            <p className="text-lg leading-relaxed text-gray-700">
              {currentPage.narration}
            </p>
          </div>

          {/* Re-engagement nudge */}
          {nudgeText && (
            <div
              className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 text-center cursor-pointer transition-all hover:bg-amber-100"
              onClick={() => setNudgeText(null)}
            >
              <p className="text-sm font-medium text-amber-800">
                {narratorLabel}: &ldquo;{nudgeText}&rdquo;
              </p>
              <p className="text-xs text-amber-500 mt-1">Tap to dismiss</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                pageIndex === 0 ? "text-gray-300 cursor-not-allowed" : "text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              &larr; Back
            </button>

            {playing ? (
              <button
                onClick={handleSpeak}
                className="rounded-full px-8 py-3 text-sm font-bold transition-all shadow-md bg-red-500 text-white hover:bg-red-600"
              >
                Stop
              </button>
            ) : loading ? (
              <button
                disabled
                className="rounded-full px-8 py-3 text-sm font-bold shadow-md bg-gray-300 text-gray-500 cursor-wait"
              >
                Loading...
              </button>
            ) : hasFinishedReading ? (
              <button
                onClick={handleSpeak}
                className="rounded-full px-8 py-3 text-sm font-bold transition-all shadow-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg"
              >
                {"\ud83d\udd01"} Read Again
              </button>
            ) : null}

            {needsChoice ? (
              <div className="text-sm text-indigo-400 font-medium">Make a choice &darr;</div>
            ) : isLastPage ? (
              <button onClick={handleRestart} className="rounded-full px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all">
                Restart
              </button>
            ) : (
              <button onClick={handleNext} className="rounded-full px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all">
                Next &rarr;
              </button>
            )}
          </div>

          {/* Choice UI */}
          {needsChoice && currentPage.choice && (
            <div className="rounded-2xl bg-indigo-50 border-2 border-indigo-200 p-6 space-y-4">
              <p className="text-center font-semibold text-indigo-800">{currentPage.choice.question}</p>
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

      <NarratorChat
        narratorId={narratorId}
        voiceId={voiceId}
        topic={topic}
        currentNarration={currentPage.narration}
        narratorName={narratorName}
        onChatStatusChange={handleChatStatusChange}
      />
    </div>
  );
}
