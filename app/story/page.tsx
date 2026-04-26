"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getReadingOrder, TORNADO_STORY, PYRAMIDS_STORY, type Story, type Page } from "../lib/stories";
import { NARRATORS, isNarratorId, getVoiceId, type NarratorId, type NarratorInfo } from "../lib/narrators";
import { topicToSlug } from "../lib/generateUtils";
import { NarratorChat } from "../components/narrator-chat";
import { useNarrator } from "../components/narrator-context";
import { MagnifyingGlass } from "../components/magnifying-glass";
import { ChoicePage } from "../components/choice-page";
import { CompletionPage } from "../components/completion-page";

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
  const router = useRouter();
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
  const [chatActive, setChatActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationRef = useRef<HTMLParagraphElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const narrator = NARRATORS[narratorId];
  const voiceId = getVoiceId(narratorId, customVoiceId);

  // --- Story generation (try cache first, then generate) ---
  useEffect(() => {
    if (isDemo) return;
    const controller = new AbortController();
    async function generate() {
      setGenerating(true);
      setError(null);
      const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 2500));
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
          await minDelay;
          if (!controller.signal.aborted) setStory(data);
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
  const clearHighlights = useCallback(() => {
    narrationRef.current?.querySelectorAll<HTMLElement>("[data-widx]").forEach((el) => {
      el.style.backgroundColor = "transparent";
      el.style.color = "inherit";
    });
  }, []);

  const stopAudio = useCallback((preserveHighlights = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (!preserveHighlights) audioRef.current = null;
    }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (!preserveHighlights) clearHighlights();
    setPlaying(false);
  }, [clearHighlights]);

  const startWordTracking = useCallback((audio: HTMLAudioElement, timestamps: Page["timestamps"]) => {
    if (!timestamps?.length) return;
    let lastIdx = -2;
    const tick = () => {
      const t = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < timestamps.length; i++) {
        if (t >= timestamps[i].start && t <= timestamps[i].end + 0.05) { idx = i; break; }
      }
      if (idx !== lastIdx && idx >= 0 && narrationRef.current) {
        lastIdx = idx;
        narrationRef.current.querySelectorAll<HTMLElement>("[data-widx]").forEach((el) => {
          const wi = Number(el.dataset.widx);
          if (wi === idx) {
            el.style.backgroundColor = "#fee8d3";
            el.style.color = "#f09237";
          } else if (wi > idx) {
            el.style.backgroundColor = "transparent";
            el.style.color = "#b4b4b4";
          } else {
            el.style.backgroundColor = "transparent";
            el.style.color = "inherit";
          }
        });
      }
      if (!audio.paused) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const playNarration = useCallback(async (page: Page) => {
    // Resume paused audio for this page rather than restarting
    if (audioRef.current && audioRef.current.paused && !audioRef.current.ended) {
      setPlaying(true);
      await audioRef.current.play();
      startWordTracking(audioRef.current, page.timestamps);
      return;
    }

    stopAudio();
    setHasFinishedReading(false);

    if (page.audio_url) {
      setPlaying(true);
      const audio = new Audio(page.audio_url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); setHasFinishedReading(true); clearHighlights(); audioRef.current = null; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
      await audio.play();
      startWordTracking(audio, page.timestamps);
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
    if (playing) { stopAudio(true); return; }
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

  // --- Render: completion (Figma ending screen) ---
  if (story && !generating && isLastPage && hasFinishedReading) {
    return (
      <CompletionPage
        narrator={narrator}
        storyTitle={story.title}
        onContinue={() => router.push("/library")}
      />
    );
  }

  // --- Render: choice (Figma fullscreen takeover) ---
  if (story && !generating && needsChoice && currentPage?.choice) {
    return (
      <ChoicePage
        narrator={narrator}
        storyTitle={story.title}
        pageIndex={pageIndex}
        totalPages={pages.length}
        question={currentPage.choice.question}
        optionA={{
          label: currentPage.choice.option_a.label,
          imageUrl: currentPage.choice.option_a.image_url,
        }}
        optionB={{
          label: currentPage.choice.option_b.label,
          imageUrl: currentPage.choice.option_b.image_url,
        }}
        onChoose={handleChoice}
      />
    );
  }

  // --- Render: generating ---
  if (generating) {
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white px-6">
        <div className="text-center space-y-4">
          <div className="mx-auto inline-block h-10 w-10 animate-spin rounded-full border-4 border-[#f29337]/20 border-t-[#f29337]" />
          <h2 className="font-chelsea text-[18px] text-black md:text-[22px]">
            {narrator.short} is creating your story...
          </h2>
          <p className="font-grandstander text-[14px] text-[#585858] md:text-[17px]">About: {topic}</p>
        </div>
      </main>
    );
  }

  // --- Render: error ---
  if (error || !story || !currentPage) {
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white px-6">
        <div className="text-center space-y-4">
          <p className="font-grandstander text-[14px] text-red-600 md:text-[17px]">{error ?? "Something went wrong"}</p>
          <a href="/library" className="inline-block rounded-full bg-[#f09237] px-4 py-2.5 font-grandstander text-[13px] font-medium text-white shadow-[2px_4px_0px_0px_#db6c00] transition-transform hover:scale-[1.03] md:text-[15px]">
            Try Again
          </a>
        </div>
      </main>
    );
  }

  const totalPages = pages.length;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white">
      {/* Decorative leaves */}
      <DecorLeaf src="/figma/landing/leaf-3.svg" size={78} rotate={18.88} className="left-[2%] top-[48%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-1.svg" size={91} rotate={55.56} className="right-[3%] top-[5%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-2.svg" size={63} rotate={-72.55} className="right-[8%] top-[12%] hidden md:block" />

      <div className="relative mx-auto flex w-full max-w-[880px] flex-col gap-5 px-6 py-5 md:px-8 md:py-8 md:gap-6">
        {/* Header */}
        <header className="flex w-full flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-8">
            <NarratorBadge narrator={narrator} />
            <div className="flex flex-col gap-1 md:gap-2">
              <h1 className="font-chelsea text-[18px] leading-tight text-black md:text-[22px]">{story.title}</h1>
              <p className="text-[14px] text-[#585858] md:text-[17px]" style={{ fontFamily: "var(--font-abeezee), sans-serif" }}>
                Narrator: {narrator.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => { document.querySelector<HTMLButtonElement>("[data-narrator-chat-trigger]")?.click(); }}
            className={`flex items-center justify-center gap-2 rounded-[48px] px-4 py-2.5 transition-transform hover:scale-[1.03] active:translate-y-[2px] md:gap-2 md:px-5 md:py-3 ${
              chatActive
                ? "bg-red-500 shadow-[2px_4px_0px_0px_#b91c1c,2px_2px_20px_rgba(0,0,0,0.1)] active:shadow-[2px_4px_0px_0px_#b91c1c,2px_2px_20px_rgba(0,0,0,0.1)]"
                : "bg-[#f09237] shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)]"
            }`}
          >
            <MicIcon />
            <span className="font-grandstander text-[14px] font-medium text-[#fef9f3] md:text-[14px]">
              {chatActive ? `Stop ${narrator.short}` : `Talk to ${narrator.short}`}
            </span>
          </button>
        </header>

        {/* Story card */}
        <section className="flex w-full flex-col items-center gap-4 rounded-[24px] bg-white p-5 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:gap-6 md:px-8 md:py-8">
          {/* Page indicator + progress */}
          <div className="flex w-full flex-col items-center gap-3 md:gap-4">
            <div className="flex items-center justify-center gap-6 md:gap-8">
              <button onClick={handlePrev} disabled={pageIndex === 0} aria-label="Previous page" className="transition-transform hover:scale-110 disabled:opacity-30">
                <ArrowLeftSmall />
              </button>
              <span className="font-grandstander text-[13px] font-medium text-black md:text-[15px]">Page {pageIndex + 1} of {totalPages}</span>
              <button onClick={handleNext} disabled={pageIndex === totalPages - 1 || !!needsChoice} aria-label="Next page" className="transition-transform hover:scale-110 disabled:opacity-30">
                <ArrowRightSmall />
              </button>
            </div>
            <div className="flex w-full max-w-full gap-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <div key={i} className="h-[3px] flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= pageIndex ? "#f09237" : "#eaeaea" }} />
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
            </div>
          </div>

          {/* Narration text with word highlighting */}
          <p ref={narrationRef} className="w-full text-[14px] leading-[1.65] text-black md:text-[17px] md:leading-[1.8]" style={{ fontFamily: "var(--font-abeezee), sans-serif" }}>
            {currentPage.timestamps?.length ? (
              currentPage.timestamps.map((wt, i) => (
                <span
                  key={i}
                  data-widx={i}
                  className="transition-colors duration-100"
                  style={{ borderRadius: "4px", padding: "1px 2px" }}
                >
                  {stripMarkdown(wt.word)}{" "}
                </span>
              ))
            ) : (
              stripMarkdown(currentPage.narration)
            )}
          </p>

          {/* Bottom controls */}
          <div className="relative flex w-full items-center justify-between">
            <button onClick={handlePrev} disabled={pageIndex === 0} aria-label="Previous page" className="flex size-12 items-center justify-center rounded-full border border-[#eaeaea] bg-[#eaeaea] shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 disabled:opacity-40 md:size-14">
              <ArrowLeftLarge />
            </button>
            <button onClick={handleSpeak} disabled={loading} aria-label={playing ? "Pause" : "Play"} className="flex size-12 items-center justify-center rounded-full bg-[#f09237] shadow-[2px_2px_10px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 disabled:opacity-60 md:size-14">
              {loading ? (
                <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white md:size-6" />
              ) : playing ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </button>
            {isLastPage ? (
              <a href="/library" aria-label="Go home" className="flex size-12 items-center justify-center rounded-full bg-[#f09237] shadow-[2px_2px_10px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 md:size-14">
                <HomeIcon />
              </a>
            ) : (
              <button onClick={handleNext} disabled={!!needsChoice} aria-label="Next page" className="flex size-12 items-center justify-center rounded-full border border-[#fee8d3] bg-[#fee8d3] shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 disabled:opacity-40 md:size-14">
                <ArrowRightLarge />
              </button>
            )}
          </div>

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
    <div className="flex size-[48px] items-center justify-center overflow-hidden rounded-full border border-[#f09237] shadow-[2px_2px_20px_0px_#f09237] md:size-[60px]" style={{ backgroundColor: narrator.bg }}>
      {narrator.image ? (
        <div className="relative size-[38px] md:size-[48px]">
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
    <div className="relative size-3.5 overflow-hidden md:size-4.5">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="md:size-5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ArrowRightSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="md:size-5">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ArrowLeftLarge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="md:size-7">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ArrowRightLarge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f09237" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="md:size-7">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="md:size-7">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="md:size-7">
      <rect x="9" y="7" width="5" height="18" rx="1.5" fill="white" />
      <rect x="18" y="7" width="5" height="18" rx="1.5" fill="white" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="md:size-7">
      <path d="M9 6.5C9 5.67157 9.92143 5.18743 10.6055 5.65149L24.6055 15.1515C25.215 15.5651 25.215 16.4349 24.6055 16.8485L10.6055 26.3485C9.92143 26.8126 9 26.3284 9 25.5V6.5Z" fill="white" />
    </svg>
  );
}
