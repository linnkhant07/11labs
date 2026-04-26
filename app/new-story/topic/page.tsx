"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Topic = { id: string; label: string; emoji: string };

const SCIENCE_TOPICS: Topic[] = [
  { id: "electricity", label: "What is Electricity?", emoji: "\u26a1" },
  { id: "moon-phases", label: "Moon Phases", emoji: "\ud83c\udf19" },
  { id: "water-cycle", label: "The Water Cycle", emoji: "\ud83d\udca7" },
  { id: "amazon-rainforest", label: "The Amazon Rainforest", emoji: "\ud83c\udf3f" },
  { id: "photosynthesis", label: "Photosynthesis", emoji: "\ud83c\udf3b" },
  { id: "herbivores-carnivores", label: "Herbivores vs Carnivores", emoji: "\ud83e\udd96" },
  { id: "clouds", label: "Types of Clouds", emoji: "\u2601\ufe0f" },
];

const HISTORY_TOPICS: Topic[] = [
  { id: "pyramids", label: "The Pyramids", emoji: "\ud83d\udea7" },
  { id: "titanic", label: "The Titanic", emoji: "\ud83d\udea2" },
  { id: "ancient-rome", label: "Ancient Rome", emoji: "\ud83c\udfdb\ufe0f" },
  { id: "moon-landing", label: "The Moon Landing", emoji: "\ud83d\ude80" },
  { id: "great-wall", label: "The Great Wall of China", emoji: "\ud83c\udfc4" },
  { id: "vikings", label: "The Vikings", emoji: "\u2693" },
  { id: "dinosaurs", label: "Dinosaurs", emoji: "\ud83e\udd95" },
];

export default function ChooseTopic() {
  const router = useRouter();
  const params = useSearchParams();
  const narrator = params.get("narrator") ?? "fox";
  const category = params.get("category") ?? "science";

  const topics = category === "history" ? HISTORY_TOPICS : SCIENCE_TOPICS;
  const [selected, setSelected] = useState<string>(topics[1]?.id ?? topics[0].id);

  function createStory() {
    const topic = topics.find((t) => t.id === selected);
    if (!topic) return;
    const next = new URLSearchParams({ topic: topic.label, narrator });
    router.push(`/story?${next.toString()}`);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white">
      <button onClick={() => router.push(`/new-story?narrator=${narrator}`)} aria-label="Go back" className="absolute left-6 top-6 z-10 flex size-16 items-center justify-center rounded-full border border-white bg-white shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 md:left-10 md:top-10 md:size-20">
        <ArrowLeftIcon />
      </button>

      <DecorLeaf src="/figma/category/leaf-4.svg" size={128} rotate={26.41} className="left-[15%] top-[42%] hidden md:block" />
      <DecorLeaf src="/figma/category/leaf-5.svg" size={89} rotate={-26.87} className="left-[7%] top-[60%] hidden md:block" />
      <DecorLeaf src="/figma/category/leaf-6.svg" size={128} rotate={-18.1} className="right-[5%] top-[55%] hidden md:block" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1280px] flex-col items-center justify-center gap-14 px-6 py-20 md:px-20">
        <h1 className="font-chelsea text-center text-[32px] text-black md:text-[44px]">Choose a topic</h1>

        <section className="flex w-full max-w-[662px] flex-col items-center gap-8 rounded-[24px] border border-white bg-white p-6 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:gap-10 md:p-12">
          <div className="flex w-full flex-wrap items-start justify-center gap-x-2.5 gap-y-4">
            {topics.map((t) => {
              const isSelected = t.id === selected;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className="flex shrink-0 items-center justify-center gap-4 rounded-full border-2 px-6 py-2.5 text-center transition-transform hover:scale-[1.03] focus:outline-none"
                  style={{
                    backgroundColor: isSelected ? "#fee8d3" : "#ffffff",
                    borderColor: isSelected ? "#f29337" : "#cfcfcf",
                    boxShadow: isSelected ? "2px 3px 0px 0px #f29337, 2px 2px 2px 0px rgba(0,0,0,0.25)" : "2px 3px 0px 0px #cfcfcf, 2px 2px 2px 0px rgba(0,0,0,0.1)",
                  }}
                >
                  <span className="text-[20px] leading-none md:text-[24px]">{t.emoji}</span>
                  <span className="whitespace-nowrap text-[16px] font-semibold text-black md:text-[20px]" style={{ fontFamily: "var(--font-nunito), sans-serif" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <button onClick={createStory} className="flex items-end justify-center gap-6 rounded-[48px] bg-[#f09237] px-10 py-5 shadow-[4px_8px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.03] focus:outline-none active:translate-y-[2px] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] md:px-12 md:py-[26px]">
          <SparkleIcon />
          <span className="font-grandstander text-[22px] font-medium text-white md:text-[26px]">Create Story</span>
        </button>
      </div>
    </main>
  );
}

function DecorLeaf({ src, size, rotate, className = "" }: { src: string; size: number; rotate: number; className?: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}>
      <Image src={src} alt="" fill sizes="128px" className="object-contain" />
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <div className="relative size-9 overflow-hidden md:size-10">
      <div className="absolute inset-[16.67%_45.83%_16.67%_16.67%]"><img src="/figma/category/arrow-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[45.83%_16.67%]"><img src="/figma/category/arrow-2.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <div className="relative size-6 overflow-hidden md:size-7">
      <div className="absolute inset-[4.17%_4.16%_4.17%_4.17%]"><img src="/figma/landing/sparkle-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[8.33%_12.5%_66.67%_79.17%]"><img src="/figma/landing/sparkle-2.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-3/4 left-[70.83%] right-[4.17%] top-[16.67%]"><img src="/figma/landing/sparkle-3.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[66.67%_79.17%_16.67%_12.5%]"><img src="/figma/landing/sparkle-4.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-[20.83%] left-[8.33%] right-3/4 top-[70.83%]"><img src="/figma/landing/sparkle-5.svg" alt="" className="size-full" /></div>
    </div>
  );
}
