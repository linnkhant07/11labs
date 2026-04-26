"use client";

import Image from "next/image";
import { useState } from "react";
import type { NarratorInfo } from "../lib/narrators";

type ChoicePageProps = {
  narrator: NarratorInfo;
  storyTitle: string;
  pageIndex: number;
  totalPages: number;
  question: string;
  optionA: { label: string; imageUrl: string };
  optionB: { label: string; imageUrl: string };
  onChoose: (option: "a" | "b") => void;
};

export function ChoicePage({
  narrator,
  storyTitle,
  pageIndex,
  totalPages,
  question,
  optionA,
  optionB,
  onChoose,
}: ChoicePageProps) {
  const [selected, setSelected] = useState<"a" | "b" | null>(null);

  function handleContinue() {
    if (!selected) return;
    onChoose(selected);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white">
      {/* Decorative leaves — match the rest of /story */}
      <DecorLeaf src="/figma/landing/leaf-3.svg" size={78} rotate={18.88} className="left-[2%] top-[48%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-1.svg" size={91} rotate={55.56} className="right-[3%] top-[5%] hidden md:block" />
      <DecorLeaf src="/figma/landing/leaf-2.svg" size={63} rotate={-72.55} className="right-[8%] top-[12%] hidden md:block" />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-6 py-10 md:px-16 md:py-20 md:gap-14 lg:px-24">
        {/* Header */}
        <header className="flex w-full items-center gap-6 md:gap-12">
          <NarratorBadge narrator={narrator} />
          <div className="flex flex-col gap-2 md:gap-3">
            <h1 className="font-chelsea text-[28px] leading-tight text-black md:text-[44px]">{storyTitle}</h1>
            <p
              className="text-[16px] text-[#585858] md:text-[24px]"
              style={{ fontFamily: "var(--font-abeezee), sans-serif" }}
            >
              Narrator: {narrator.name}
            </p>
          </div>
        </header>

        {/* Card */}
        <section className="flex w-full flex-col items-center gap-12 rounded-[24px] bg-white p-6 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:px-10 md:py-[60px]">
          {/* Page indicator + progress bar */}
          <div className="flex w-full flex-col items-center gap-6 md:gap-8">
            <span className="font-grandstander text-[22px] font-medium text-black md:text-[28px]">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <div className="flex w-full max-w-full gap-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  className="h-[6px] flex-1 rounded-full transition-colors"
                  style={{ backgroundColor: i <= pageIndex ? "#f09237" : "#eaeaea" }}
                />
              ))}
            </div>
          </div>

          {/* Question + choices + continue */}
          <div className="flex w-full flex-col items-center gap-[60px] pt-4">
            <h2 className="font-grandstander text-center text-[26px] font-medium text-black md:text-[32px]">
              {question}
            </h2>

            <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
              <ChoiceCard
                label={optionA.label}
                imageUrl={optionA.imageUrl}
                selected={selected === "a"}
                onSelect={() => setSelected("a")}
              />
              <ChoiceCard
                label={optionB.label}
                imageUrl={optionB.imageUrl}
                selected={selected === "b"}
                onSelect={() => setSelected("b")}
              />
            </div>

            <ContinueButton enabled={selected !== null} onClick={handleContinue} />
          </div>
        </section>
      </div>
    </main>
  );
}

function ChoiceCard({
  label,
  imageUrl,
  selected,
  onSelect,
}: {
  label: string;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full flex-col overflow-hidden rounded-[24px] bg-white text-left transition-all hover:scale-[1.02] focus:outline-none ${
        selected
          ? "ring-2 ring-[#f09237] shadow-[2px_2px_20px_#f29337]"
          : "shadow-[2px_2px_10px_rgba(0,0,0,0.1)]"
      }`}
    >
      <div className="relative aspect-[450/195] w-full">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-amber-200 to-orange-300" />
        )}
      </div>
      <div className="flex h-[142px] w-full items-center justify-center px-7 py-5">
        <p
          className="text-center text-[20px] text-[#585858] md:text-[24px]"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          {label}
        </p>
      </div>
    </button>
  );
}

function ContinueButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`flex items-center justify-center gap-4 rounded-[48px] px-12 py-[22px] transition-transform md:gap-6 ${
        enabled
          ? "bg-[#f09237] text-white shadow-[2px_8px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] hover:scale-[1.03] active:translate-y-[2px] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)]"
          : "bg-[#e1e1e1] text-[#8a8a8a] shadow-[2px_8px_0px_0px_#b4b4b4,2px_2px_20px_rgba(0,0,0,0.1)] cursor-not-allowed"
      }`}
    >
      <span className="font-grandstander text-[22px] font-medium md:text-[26px]">Continue</span>
      <ArrowRightIcon active={enabled} />
    </button>
  );
}

function NarratorBadge({ narrator }: { narrator: NarratorInfo }) {
  return (
    <div
      className="flex size-[80px] items-center justify-center overflow-hidden rounded-full border border-[#f09237] shadow-[2px_2px_20px_0px_#f09237] md:size-[108px]"
      style={{ backgroundColor: narrator.bg }}
    >
      {narrator.image ? (
        <div className="relative size-[64px] md:size-[88px]">
          <Image src={narrator.image} alt={narrator.name} fill sizes="108px" className="object-contain" />
        </div>
      ) : null}
    </div>
  );
}

function DecorLeaf({ src, size, rotate, className = "" }: { src: string; size: number; rotate: number; className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute ${className}`}
      style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}
    >
      <Image src={src} alt="" fill sizes="100px" className="object-contain" />
    </div>
  );
}

function ArrowRightIcon({ active }: { active: boolean }) {
  const filter = active ? undefined : "grayscale(100%) brightness(0.6)";
  return (
    <div className="relative h-7 w-6 overflow-hidden md:h-8 md:w-7">
      <div className="absolute inset-[45.83%_16.67%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/storybook/arrow-right-2.svg" alt="" className="size-full" style={{ filter }} />
      </div>
      <div className="absolute inset-[16.67%_16.67%_16.67%_45.83%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/storybook/arrow-right-1.svg" alt="" className="size-full" style={{ filter }} />
      </div>
    </div>
  );
}
