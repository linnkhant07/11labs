"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type QuizOption = { id: string; label: string };

const NARRATOR_META: Record<
  string,
  { name: string; image: string; bg: string; imageSize: number }
> = {
  fox: {
    name: "Finn the Fox",
    image: "/figma/landing/finn-fox.png",
    bg: "#ffeeca",
    imageSize: 80,
  },
  sloth: {
    name: "Sally the Sloth",
    image: "/figma/landing/sally-sloth.png",
    bg: "#f0dac6",
    imageSize: 80,
  },
  grandma: {
    name: "Grandma",
    image: "/figma/landing/grandma.png",
    bg: "transparent",
    imageSize: 108,
  },
};

const OPTIONS: QuizOption[] = [
  { id: "a", label: "The Moon orbits the Sun" },
  { id: "b", label: "The Earth orbits the Moon" },
  { id: "c", label: "The Moon orbits the Earth" },
];

const TOTAL_PAGES = 6;

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <Quiz />
    </Suspense>
  );
}

function Quiz() {
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get("topic") ?? "The Moon Phases";
  const narratorId = params.get("narrator") ?? "fox";
  const currentPage = clampPage(Number(params.get("page") ?? "3"));
  const narrator = NARRATOR_META[narratorId] ?? NARRATOR_META.fox;

  const [selected, setSelected] = useState<string | null>("b");

  function gotoPage(next: number) {
    const n = clampPage(next);
    const qs = new URLSearchParams({
      topic,
      narrator: narratorId,
      page: String(n),
    });
    router.push(`/quiz?${qs.toString()}`);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white">
      {/* Decorative leaves */}
      <DecorLeaf
        src="/figma/landing/leaf-1.svg"
        size={91}
        rotate={55.56}
        className="right-[3%] top-[6%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/landing/leaf-2.svg"
        size={63}
        rotate={-72.55}
        className="right-[8%] top-[14%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/landing/leaf-3.svg"
        size={77}
        rotate={18.88}
        className="left-[2%] top-[55%] hidden md:block"
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-14 px-6 py-12 md:px-16 md:py-20 lg:px-24">
        {/* Header */}
        <header className="flex items-center gap-8 md:gap-13">
          <div
            className="flex size-[88px] items-center justify-center overflow-hidden rounded-full border border-[#f09237] shadow-[2px_2px_20px_0px_#f09237] md:size-[108px]"
            style={{ backgroundColor: narrator.bg }}
          >
            <div
              className="relative shrink-0"
              style={{ width: narrator.imageSize, height: narrator.imageSize }}
            >
              <Image
                src={narrator.image}
                alt={narrator.name}
                fill
                sizes="108px"
                className={
                  narratorId === "grandma" ? "object-cover" : "object-contain"
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-chelsea text-[32px] text-black md:text-[44px]">
              {topic}
            </h1>
            <p
              className="text-[20px] text-[#585858] md:text-[24px]"
              style={{ fontFamily: "var(--font-abeezee), sans-serif" }}
            >
              Narrator: {narrator.name}
            </p>
          </div>
        </header>

        {/* Card */}
        <section className="flex w-full flex-col items-center gap-12 rounded-[24px] bg-white px-6 py-10 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:px-10 md:py-15">
          {/* Page nav + progress */}
          <div className="flex w-full flex-col items-center gap-8">
            <div className="flex items-center justify-center gap-10">
              <button
                onClick={() => gotoPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowLeftIcon />
              </button>
              <p className="font-grandstander text-[24px] font-medium text-black md:text-[28px]">
                Page {currentPage} of {TOTAL_PAGES}
              </p>
              <button
                onClick={() => gotoPage(currentPage + 1)}
                disabled={currentPage >= TOTAL_PAGES}
                aria-label="Next page"
                className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowRightIcon />
              </button>
            </div>
            <ProgressBar current={currentPage} total={TOTAL_PAGES} />
          </div>

          {/* Quiz */}
          <div className="flex w-full max-w-[561px] flex-col items-center gap-14 p-6 md:p-10">
            <h2 className="font-grandstander text-center text-[26px] font-medium leading-[32px] text-black md:text-[32px]">
              Which statement is true?
            </h2>

            <div className="flex w-full flex-col gap-6">
              {OPTIONS.map((opt) => {
                const isSelected = selected === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelected(opt.id)}
                    aria-pressed={isSelected}
                    className="flex w-full items-center justify-center rounded-[16px] border-2 px-6 py-5 text-center font-grandstander text-[20px] font-medium leading-[28px] shadow-[2px_2px_10px_rgba(0,0,0,0.1)] transition-colors md:text-[22px]"
                    style={{
                      backgroundColor: isSelected ? "#fcebdc" : "#f5f5f5",
                      borderColor: isSelected
                        ? "rgba(242,147,55,0.5)"
                        : "#e1e1e1",
                      color: isSelected ? "#db6c00" : "#585858",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={selected === null}
              onClick={() => {
                /* TODO: wire up answer check */
              }}
              className="rounded-[48px] bg-[#f09237] px-12 py-6 font-grandstander text-[22px] font-medium text-white shadow-[2px_8px_0px_0px_#db6c00,2px_2px_20px_0px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.03] active:translate-y-[2px] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_0px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-60 md:text-[24px]"
            >
              Check Answer
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function clampPage(n: number) {
  if (Number.isNaN(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), TOTAL_PAGES);
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex w-full max-w-[561px] gap-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] flex-1 rounded-full"
          style={{ backgroundColor: i < current ? "#f09237" : "#e1e1e1" }}
        />
      ))}
    </div>
  );
}

function DecorLeaf({
  src,
  size,
  rotate,
  className = "",
}: {
  src: string;
  size: number;
  rotate: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute ${className}`}
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <Image src={src} alt="" fill sizes="100px" className="object-contain" />
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <div
      className="relative size-8 overflow-hidden"
      style={{ filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.25))" }}
    >
      <div className="absolute inset-[16.67%_45.83%_16.67%_16.67%]">
        <img src="/figma/category/arrow-1.svg" alt="" className="size-full" />
      </div>
      <div className="absolute inset-[45.83%_16.67%]">
        <img src="/figma/category/arrow-2.svg" alt="" className="size-full" />
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <div
      className="relative h-8 w-[27px] overflow-hidden"
      style={{ filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.25))" }}
    >
      <div className="absolute inset-[45.83%_16.67%]">
        <img src="/figma/quiz/arrow-right-1.svg" alt="" className="size-full" />
      </div>
      <div className="absolute inset-[16.67%_16.67%_16.67%_45.83%]">
        <img src="/figma/quiz/arrow-right-2.svg" alt="" className="size-full" />
      </div>
    </div>
  );
}
