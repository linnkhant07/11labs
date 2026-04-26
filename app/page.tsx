"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WaveformChat } from "./components/waveform-chat";
import { useNarrator } from "./components/narrator-context";
import { NARRATORS, isNarratorId, type NarratorId } from "./lib/narrators";

type NarratorOption = {
  id: NarratorId | "record";
  name: string;
  bg: string;
  image?: string;
  imageSize?: number;
  isRecord?: boolean;
};

const NARRATOR_OPTIONS: NarratorOption[] = [
  {
    id: "record",
    name: "Record a Voice",
    bg: "#f29337",
    isRecord: true,
  },
  {
    id: "mouse",
    name: NARRATORS.mouse.name,
    bg: NARRATORS.mouse.bg,
    image: NARRATORS.mouse.image,
    imageSize: 100,
  },
  {
    id: "rabbit",
    name: NARRATORS.rabbit.name,
    bg: NARRATORS.rabbit.bg,
    image: NARRATORS.rabbit.image,
    imageSize: 100,
  },
  {
    id: "owl",
    name: NARRATORS.owl.name,
    bg: NARRATORS.owl.bg,
    image: NARRATORS.owl.image,
    imageSize: 128,
  },
];

type LibraryItem = {
  id: string;
  title: string;
  emoji?: string;
  isCreate?: boolean;
};

const LIBRARY: LibraryItem[] = [
  { id: "create", title: "Create a New Story", isCreate: true },
  { id: "tornadoes", title: "What are Tornadoes?", emoji: "\ud83c\udf2a\ufe0f" },
  { id: "rainforests", title: "Rainforests Ecosystems", emoji: "\ud83e\udd9c" },
  { id: "titanic", title: "The Titanic", emoji: "\ud83d\udea2" },
];

export default function Home() {
  const router = useRouter();
  const { narratorId, hasChosen, libraryId, setNarrator } = useNarrator();
  const [selected, setSelected] = useState<NarratorOption["id"] | null>(null);

  // Mirror narrator context into local state. Lets the voice agent's
  // select_character tool drive the avatar highlight and library unlock.
  useEffect(() => {
    if (hasChosen) setSelected(narratorId);
  }, [hasChosen, narratorId]);

  function chooseNarrator(id: NarratorOption["id"]) {
    setSelected(id);
    if (isNarratorId(id)) setNarrator(id);
  }

  function handleStart(item: LibraryItem) {
    if (!selected) return;
    const narratorId = selected === "record" ? "custom" : selected;
    if (item.isCreate) {
      router.push(`/new-story?narrator=${narratorId}`);
      return;
    }
    const params = new URLSearchParams({
      topic: item.title,
      narrator: narratorId,
    });
    router.push(`/story?${params.toString()}`);
  }

  return (
    <main
      className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fcebdc] to-[#fbfffd]"
      style={{ zoom: 0.8, minHeight: "calc(100vh / 0.8)" }}
    >
      {/* Decorative leaves */}
      <DecorLeaf src="/figma/landing/leaf-1.svg" size={91} rotate={26.41} className="right-[3%] top-[7%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-2.svg" size={63} rotate={-101.7} className="right-[8%] top-[4%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-3.svg" size={77} rotate={18.88} className="left-[2%] top-[42%] hidden md:block" />

      <div className="relative mx-auto flex w-full max-w-[880px] flex-col gap-6 px-6 py-6 md:px-8 md:py-8 md:gap-8">
        {/* Title */}
        <h1 className="font-chelsea text-[28px] text-black md:text-[36px]">
          Welcome to educ-ATE! 👋
        </h1>

        {/* Narrator card */}
        <section className="flex w-full flex-col items-start gap-6 rounded-[24px] bg-white p-6 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:gap-8 md:px-8 md:py-8">
          <h2 className="font-grandstander text-[20px] font-medium text-black md:text-[26px]">
            Choose your Narrator
          </h2>
          <div className="flex w-full flex-wrap justify-evenly gap-4">
            {NARRATOR_OPTIONS.map((n) => (
              <NarratorAvatar
                key={n.id}
                narrator={n}
                selected={selected === n.id}
                onSelect={() => {
                  chooseNarrator(n.id);
                  if (n.isRecord) router.push("/record-voice");
                }}
              />
            ))}
          </div>
        </section>

        {/* Library card */}
        <section className="flex w-full flex-col items-start gap-6 rounded-[24px] bg-white p-6 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:gap-8 md:px-8 md:py-8">
          <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-grandstander text-[20px] font-medium text-black md:text-[26px]">
              Your Library
            </h2>
            {!selected && (
              <p
                className="text-[13px] text-[#a05a1f] md:text-[15px]"
                style={{ fontFamily: "var(--font-abeezee), sans-serif" }}
              >
                Pick a narrator above to begin.
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {LIBRARY.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                disabled={!selected}
                selected={libraryId === item.id}
                onSelect={() => handleStart(item)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8">
        <WaveformChat />
      </div>
    </main>
  );
}

function NarratorAvatar({ narrator, selected, onSelect }: { narrator: NarratorOption; selected: boolean; onSelect: () => void }) {
  const baseShadow = "2px 2px 20px 0px rgba(0,0,0,0.15)";
  const selectedShadow = "2px 2px 20px 0px #f29337";

  return (
    <button onClick={onSelect} className="flex w-[130px] flex-col items-center gap-4 transition-transform hover:scale-[1.03] focus:outline-none md:w-[140px]">
      <div
        className="flex size-[112px] items-center justify-center overflow-hidden rounded-full md:size-[128px]"
        style={{ backgroundColor: narrator.bg, border: selected ? "2px solid #f09237" : undefined, boxShadow: selected ? selectedShadow : baseShadow }}
      >
        {narrator.isRecord ? (
          <MicIcon />
        ) : narrator.id === "owl" ? (
          <Image src={narrator.image!} alt={narrator.name} width={128} height={128} className="size-full object-cover" />
        ) : (
          <div className="relative shrink-0" style={{ width: narrator.imageSize, height: narrator.imageSize }}>
            <Image src={narrator.image!} alt={narrator.name} fill sizes="100px" className="object-contain" />
          </div>
        )}
      </div>
      <p className="text-center text-[16px] md:text-[18px]" style={{ fontFamily: "var(--font-abeezee), sans-serif", color: selected ? "#000" : "#585858", fontWeight: selected ? 600 : 400 }}>
        {narrator.name}
      </p>
    </button>
  );
}

function LibraryCard({
  item,
  disabled,
  selected,
  onSelect,
}: {
  item: LibraryItem;
  disabled?: boolean;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="group flex aspect-[595/842] w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-[16px] bg-[#fef9f3] px-6 py-4 shadow-[2px_2px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.02] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
    >
      {item.isCreate ? (
        <div className="flex size-[52px] items-center justify-center rounded-full bg-[#f09237] shadow-[2px_2px_20px_rgba(0,0,0,0.15)] md:size-[58px]">
          <SparkleIcon />
        </div>
      ) : (
        <span className="text-[44px] leading-none md:text-[48px]">{item.emoji}</span>
      )}
      <p className="text-center text-[16px] leading-[1.3] text-black md:text-[18px]" style={{ fontFamily: "var(--font-abeezee), sans-serif" }}>
        {item.title}
      </p>
    </button>
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
    <div className="relative size-11 overflow-hidden md:size-12">
      <div className="absolute inset-[4.17%_33.33%_33.33%_33.33%]"><img src="/figma/landing/mic-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[37.5%_16.67%_16.67%_16.67%]"><img src="/figma/landing/mic-2.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-[4.17%] left-[45.83%] right-[45.83%] top-3/4"><img src="/figma/landing/mic-3.svg" alt="" className="size-full" /></div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <div className="relative size-7 overflow-hidden md:size-8">
      <div className="absolute inset-[4.17%_4.16%_4.17%_4.17%]"><img src="/figma/landing/sparkle-1.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[8.33%_12.5%_66.67%_79.17%]"><img src="/figma/landing/sparkle-2.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-3/4 left-[70.83%] right-[4.17%] top-[16.67%]"><img src="/figma/landing/sparkle-3.svg" alt="" className="size-full" /></div>
      <div className="absolute inset-[66.67%_79.17%_16.67%_12.5%]"><img src="/figma/landing/sparkle-4.svg" alt="" className="size-full" /></div>
      <div className="absolute bottom-[20.83%] left-[8.33%] right-3/4 top-[70.83%]"><img src="/figma/landing/sparkle-5.svg" alt="" className="size-full" /></div>
    </div>
  );
}
