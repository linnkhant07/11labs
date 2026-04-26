"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getReadingOrder, TORNADO_STORY, PYRAMIDS_STORY, type Story, type Page } from "../lib/stories";
import { NARRATORS, isNarratorId, getVoiceId, type NarratorId, type NarratorInfo } from "../lib/narrators";
import { topicToSlug } from "../lib/generateUtils";
import { NarratorChat } from "../components/narrator-chat";
import { useNarrator } from "../components/narrator-context";
import { MagnifyingGlass } from "../components/magnifying-glass";

const PLACEHOLDER_GRADIENTS = [
  "from-sky-300 to-cyan-500",
  "from-slate-400 to-zinc-600",
  "from-amber-300 to-orange-500",
  "from-emerald-300 to-teal-500",
  "from-violet-300 to-purple-500",
  "from-rose-300 to-pink-500",
];

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

function stripMarkdown(text: string): string {
  return text.replace(/\*{1,3}(.*?)\*{1,3}/g, "$1");
}

function clearPageAudio(pages: Page[]) {
  for (const p of pages) {
    p.audio_url = "";
    if (p.choice) {
      clearPageAudio(p.choice.option_a.pages);
      clearPageAudio(p.choice.option_b.pages);
    }
  }
}

export default function StoryPage() {
  const searchParams = useSearchParams();
  const { narratorId: ctxNarratorId, customVoiceId, setNarrator } = useNarrator();
  const urlNarrator = searchParams.get("narrator");
  const narratorId: NarratorId = isNarratorId(urlNarrator ?? "")
    ? (urlNarrator as NarratorId)
    : ctxNarratorId;

  useEffect(() => {
    if (urlNarrator && isNarratorId(urlNarrator) && urlNarrator !== ctxNarratorId) {
      setNarrator(urlNarrator);
    }
  }, [urlNarrator, ctxNarratorId, setNarrator]);

  const topic = searchParams.get("topic") ?? "tornadoes";
  const isDemo = searchParams.get("demo") === "1";

  const demoStory: Story | null = isDemo
    ? {
        ...(topic.toLowerCase().includes("pyramid") ? PYRAMIDS_STORY : TORNADO_STORY),
        narrator: { type: "animal", character: narratorId, voice_id: "" },
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

  const narrator = NARRATORS[narratorId];
  const voiceId = getVoiceId(narratorId, customVoiceId);

  // --- Story generation (try cache first, then generate) ---
  useEffect(() => {
    if (isDemo) return;
    const controller = new AbortController();
    async function generate() {
      setGenerating(true);
      setError(null);
      try {
        const slug = topicToSlug(topic);
        const cached = await fetch(`/stories/${slug}/story.json`, { signal: controller.signal });
        if (cached.ok) {
          const data: Story = await cached.json();
          const cachedVoice = data.narrator?.voice_id;
          if (cachedVoice && cachedVoice !== voiceId) {
            console.log(`[story] Cached story voice mismatch — audio will regenerate on-demand`);
            clearPageAudio(data.pages);
          }
          console.log(`[story] Loaded cached story for "${topic}"`);
          setStory(data);
          return;
        }

        console.log(`[story] No cache for "${topic}", generating...`);
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, narrator: narratorId }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to generate story");
        const data: Story = await res.json();
        setStory(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!controller.signal.aborted) setGenerating(false);
      }
    }
    generate();
    return () => { controller.abort(); };
  }, [topic, narratorId, voiceId, isDemo]);

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
    const timeout = setTimeout(() => { playNarration(currentPage); }, 50);
    return () => { clearTimeout(timeout); stopAudio(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage?.page_id, generating]);

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
  }, [narratorId, voiceId]);

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

  // --- Render: generating ---
  if (generating) {
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white px-6">
        <div className="text-center space-y-6">
          <div className="mx-auto inline-block h-16 w-16 animate-spin rounded-full border-4 border-[#f29337]/20 border-t-[#f29337]" />
          <h2 className="font-chelsea text-[28px] text-black md:text-[36px]">
            {narrator.short} is creating your story...
          </h2>
          <p className="font-grandstander text-[18px] text-[#585858]">About: {topic}</p>
        </div>
      </main>
    );
  }

  // --- Render: error ---
  if (error || !story || !currentPage) {
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white px-6">
        <div className="text-center space-y-6">
          <p className="font-grandstander text-[20px] text-red-600">{error ?? "Something went wrong"}</p>
          <a href="/" className="inline-block rounded-full bg-[#f09237] px-8 py-3 font-grandstander text-[18px] font-medium text-white shadow-[2px_4px_0px_0px_#db6c00] transition-transform hover:scale-[1.03]">
            Try Again
          </a>
        </div>
      </main>
    );
  }

  const totalPages = pages.length;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white">
      {/* Decorative leaves */}
      <DecorLeaf src="/figma/landing/leaf-3.svg" size={78} rotate={18.88} className="left-[2%] top-[48%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-1.svg" size={91} rotate={55.56} className="right-[3%] top-[5%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-2.svg" size={63} rotate={-72.55} className="right-[8%] top-[12%] hidden md:block" />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-6 py-10 md:px-16 md:py-20 md:gap-14 lg:px-24">
        {/* Header */}
        <header className="flex w-full flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6 md:gap-12">
            <NarratorBadge narrator={narrator} />
            <div className="flex flex-col gap-2 md:gap-3">
              <h1 className="font-chelsea text-[28px] leading-tight text-black md:text-[44px]">{story.title}</h1>
              <p className="text-[16px] text-[#585858] md:text-[24px]" style={{ fontFamily: "var(--font-abeezee), sans-serif" }}>
                Narrator: {narrator.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => { document.querySelector<HTMLButtonElement>("[data-narrator-chat-trigger]")?.click(); }}
            className="flex items-center justify-center gap-4 rounded-[48px] bg-[#f09237] px-8 py-4 shadow-[2px_8px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.03] active:translate-y-[2px] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] md:gap-6 md:px-12 md:py-[26px]"
          >
            <MicIcon />
            <span className="font-grandstander text-[20px] font-medium text-[#fef9f3] md:text-[26px]">Talk to {narrator.short}</span>
          </button>
        </header>

        {/* Story card */}
        <section className="flex w-full flex-col items-center gap-8 rounded-[24px] bg-white p-6 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:gap-12 md:px-10 md:py-[60px]">
          {/* Page indicator + progress */}
          <div className="flex w-full flex-col items-center gap-6 md:gap-8">
            <div className="flex items-center justify-center gap-8 md:gap-10">
              <button onClick={handlePrev} disabled={pageIndex === 0} aria-label="Previous page" className="transition-transform hover:scale-110 disabled:opacity-30">
                <ArrowLeftSmall />
              </button>
              <span className="font-grandstander text-[22px] font-medium text-black md:text-[28px]">Page {pageIndex + 1} of {totalPages}</span>
              <button onClick={handleNext} disabled={pageIndex === totalPages - 1 || !!needsChoice} aria-label="Next page" className="transition-transform hover:scale-110 disabled:opacity-30">
                <ArrowRightSmall />
              </button>
            </div>
            <div className="flex w-full max-w-full gap-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <div key={i} className="h-[6px] flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= pageIndex ? "#f09237" : "#eaeaea" }} />
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="relative w-full overflow-hidden rounded-[24px] shadow-[2px_2px_5px_rgba(0,0,0,0.1)]">
            <div className="relative aspect-[1112/360] w-full">
              {currentPage.image_url ? (
                <>
                  <img src={currentPage.image_url} alt={currentPage.image_prompt} className="absolute inset-0 size-full rounded-[24px] object-cover" />
                  <MagnifyingGlass imageUrl={currentPage.image_url} topic={topic} narration={currentPage.narration} narrator={narratorId} />
                </>
              ) : (
                <div className={`size-full bg-gradient-to-br ${getGradient(pageIndex)} flex items-center justify-center rounded-[24px]`}>
                  <p className="px-8 text-center text-sm font-medium italic text-white/70">{currentPage.image_prompt}</p>
                </div>
              )}
              <div className="pointer-events-none absolute left-4 top-4 flex items-center justify-center rounded-full bg-[#f09237] p-3 shadow-[0px_0px_10px_#f09237] md:left-6 md:top-6 md:p-4">
                <SearchIcon />
              </div>
            </div>
          </div>

          {/* Narration text */}
          <p className="w-full text-[18px] leading-[1.7] text-black md:text-[24px] md:leading-[2]" style={{ fontFamily: "var(--font-abeezee), sans-serif" }}>
            {stripMarkdown(currentPage.narration)}
          </p>

          {/* Re-engagement nudge */}
          {nudgeText && (
            <div className="w-full cursor-pointer rounded-2xl border-2 border-[#fee8d3] bg-[#fef5ea] p-4 text-center transition-all hover:bg-[#fee8d3]" onClick={() => setNudgeText(null)}>
              <p className="font-grandstander text-[16px] font-medium text-[#f09237]">{narrator.short}: &ldquo;{nudgeText}&rdquo;</p>
              <p className="mt-1 text-xs text-[#b4b4b4]">Tap to dismiss</p>
            </div>
          )}

          {/* Bottom controls */}
          <div className="relative flex w-full items-center justify-between">
            <button onClick={handlePrev} disabled={pageIndex === 0} aria-label="Previous page" className="flex size-16 items-center justify-center rounded-full border border-[#eaeaea] bg-[#eaeaea] shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 disabled:opacity-40 md:size-20">
              <ArrowLeftLarge />
            </button>
            <button onClick={handleSpeak} disabled={loading} aria-label={playing ? "Pause" : "Play"} className="flex size-16 items-center justify-center rounded-full bg-[#f09237] shadow-[2px_2px_10px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 disabled:opacity-60 md:size-20">
              {loading ? (
                <span className="size-6 animate-spin rounded-full border-2 border-white/40 border-t-white md:size-8" />
              ) : playing ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </button>
            <button onClick={isLastPage ? handleRestart : handleNext} disabled={!!needsChoice} aria-label={isLastPage ? "Restart" : "Next page"} className="flex size-16 items-center justify-center rounded-full border border-[#fee8d3] bg-[#fee8d3] shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 disabled:opacity-40 md:size-20">
              <ArrowRightLarge />
            </button>
          </div>

          {/* Choice UI */}
          {needsChoice && currentPage.choice && (
            <div className="w-full space-y-4 rounded-2xl border-2 border-[#fee8d3] bg-[#fef9f3] p-6">
              <p className="text-center font-grandstander text-[18px] font-medium text-[#f29337] md:text-[22px]">{currentPage.choice.question}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  onClick={() => handleChoice("a")}
                  className="overflow-hidden rounded-xl border-2 border-[#cfcfcf] bg-white text-center text-[16px] font-semibold text-black shadow-[2px_3px_0px_0px_#cfcfcf] transition-all hover:scale-[1.02] hover:border-[#f29337] hover:shadow-[2px_3px_0px_0px_#f29337] md:text-[18px]"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {currentPage.choice.option_a.image_url && (
                    <img src={currentPage.choice.option_a.image_url} alt={currentPage.choice.option_a.label} className="w-full h-32 object-cover" />
                  )}
                  <span className="block p-4">{currentPage.choice.option_a.label}</span>
                </button>
                <button
                  onClick={() => handleChoice("b")}
                  className="overflow-hidden rounded-xl border-2 border-[#cfcfcf] bg-white text-center text-[16px] font-semibold text-black shadow-[2px_3px_0px_0px_#cfcfcf] transition-all hover:scale-[1.02] hover:border-[#f29337] hover:shadow-[2px_3px_0px_0px_#f29337] md:text-[18px]"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {currentPage.choice.option_b.image_url && (
                    <img src={currentPage.choice.option_b.image_url} alt={currentPage.choice.option_b.label} className="w-full h-32 object-cover" />
                  )}
                  <span className="block p-4">{currentPage.choice.option_b.label}</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <NarratorChat
        narratorId={narratorId}
        voiceId={voiceId}
        topic={topic}
        currentNarration={currentPage.narration}
        narratorName={narrator.name}
        onChatStatusChange={handleChatStatusChange}
      />
    </main>
  );
}

function NarratorBadge({ narrator }: { narrator: NarratorInfo }) {
  return (
    <div className="flex size-[80px] items-center justify-center overflow-hidden rounded-full border border-[#f09237] shadow-[2px_2px_20px_0px_#f09237] md:size-[108px]" style={{ backgroundColor: narrator.bg }}>
      {narrator.image ? (
        <div className="relative size-[64px] md:size-[88px]">
          <Image src={narrator.image} alt={narrator.name} fill sizes="108px" className="object-contain" />
        </div>
      ) : (
        <MicIconLarge />
      )}
    </div>
  );
}

function DecorLeaf({ src, size, rotate, className = "" }: { src: string; size: number; rotate: number; className?: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}>
      <Image src={src} alt="" fill sizes="100px" className="object-contain" />
    </div>
  );
}

function MicIcon() {
  return (
    <div className="relative size-6 overflow-hidden md:size-7">
      <div className="absolute inset-[4.17%_33.33%_33.33%_33.33%]"><img src="/figma/landing/mic-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[37.5%_16.67%_16.67%_16.67%]"><img src="/figma/landing/mic-2.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-[4.17%] left-[45.83%] right-[45.83%] top-3/4"><img src="/figma/landing/mic-3.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function MicIconLarge() {
  return (
    <div className="relative size-12 overflow-hidden">
      <div className="absolute inset-[4.17%_33.33%_33.33%_33.33%]"><img src="/figma/landing/mic-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[37.5%_16.67%_16.67%_16.67%]"><img src="/figma/landing/mic-2.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-[4.17%] left-[45.83%] right-[45.83%] top-3/4"><img src="/figma/landing/mic-3.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function ArrowLeftSmall() {
  return (
    <div className="relative size-7 overflow-hidden md:size-8">
      <div className="absolute inset-[16.67%_45.83%_16.67%_16.67%]"><img src="/figma/category/arrow-1.svg" alt="" className="size-full" style={{ filter: "grayscale(100%) brightness(0.6)" }} /></div>
      <div className="absolute inset-[45.83%_16.67%]"><img src="/figma/category/arrow-2.svg" alt="" className="size-full" style={{ filter: "grayscale(100%) brightness(0.6)" }} /></div>
    </div>
  );
}

function ArrowRightSmall() {
  return (
    <div className="relative h-7 w-6 overflow-hidden md:h-8 md:w-7">
      <div className="absolute inset-[45.83%_16.67%]"><img src="/figma/storybook/arrow-right-2.svg" alt="" className="size-full" style={{ filter: "grayscale(100%) brightness(0.6)" }} /></div>
      <div className="absolute inset-[16.67%_16.67%_16.67%_45.83%]"><img src="/figma/storybook/arrow-right-1.svg" alt="" className="size-full" style={{ filter: "grayscale(100%) brightness(0.6)" }} /></div>
    </div>
  );
}

function ArrowLeftLarge() {
  return (
    <div className="relative size-9 overflow-hidden md:size-10">
      <div className="absolute inset-[16.67%_45.83%_16.67%_16.67%]"><img src="/figma/category/arrow-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[45.83%_16.67%]"><img src="/figma/category/arrow-2.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function ArrowRightLarge() {
  return (
    <div className="relative h-9 w-8 overflow-hidden md:h-10 md:w-9">
      <div className="absolute inset-[45.83%_16.67%]"><img src="/figma/storybook/arrow-right-2.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[16.67%_16.67%_16.67%_45.83%]"><img src="/figma/storybook/arrow-right-1.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function SearchIcon() {
  return (
    <div className="relative size-7 overflow-hidden md:size-9">
      <div className="absolute inset-[8.33%_16.67%_16.67%_8.33%]"><img src="/figma/storybook/search-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[65.42%_8.33%_8.33%_65.42%]"><img src="/figma/storybook/search-2.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function PauseIcon() {
  return (
    <div className="relative size-8 overflow-hidden md:size-10">
      <div className="absolute inset-[12.5%_54.17%_12.5%_20.83%]"><img src="/figma/storybook/pause-bar.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[12.5%_20.83%_12.5%_54.17%]"><img src="/figma/storybook/pause-bar.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="md:size-10">
      <path d="M9 6.5C9 5.67157 9.92143 5.18743 10.6055 5.65149L24.6055 15.1515C25.215 15.5651 25.215 16.4349 24.6055 16.8485L10.6055 26.3485C9.92143 26.8126 9 26.3284 9 25.5V6.5Z" fill="white" />
    </svg>
  );
}
