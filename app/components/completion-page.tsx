"use client";

import Image from "next/image";
import type { NarratorInfo } from "../lib/narrators";

const ABSTRACT_SHAPES = [
  { src: "/figma/clap/abstract-211.svg", size: 128, left: "11%", top: "34%", rotate: 26.41 },
  { src: "/figma/clap/abstract-210.svg", size: 128, right: "15%", top: "48%", rotate: -18.1 },
  { src: "/figma/clap/abstract-212.svg", size: 89, left: "5%", top: "50%", rotate: -26.87 },
  { src: "/figma/clap/abstract-208.svg", size: 64, right: "28%", top: "45%", rotate: -111.96 },
  { src: "/figma/clap/abstract-209.svg", size: 44, right: "25%", top: "36%", rotate: -65.86 },
] as const;

type CompletionPageProps = {
  narrator: NarratorInfo;
  storyTitle: string;
  onContinue: () => void;
};

export function CompletionPage({ narrator, storyTitle, onContinue }: CompletionPageProps) {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center gap-16 overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white px-6 py-20">
      {ABSTRACT_SHAPES.map((shape, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={shape.src}
          alt=""
          aria-hidden
          className="pointer-events-none absolute hidden md:block"
          style={{
            width: shape.size,
            height: shape.size,
            left: "left" in shape ? shape.left : undefined,
            right: "right" in shape ? shape.right : undefined,
            top: shape.top,
            transform: `rotate(${shape.rotate}deg)`,
          }}
        />
      ))}

      {/* Narrator avatar */}
      <div
        className="relative flex size-[140px] shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[2px_2px_20px_rgba(0,0,0,0.1)] md:size-[168px]"
        style={{ backgroundColor: narrator.bg || "#c4c4c4" }}
      >
        {narrator.image ? (
          <div className="relative size-[100px] md:size-[120px]">
            <Image src={narrator.image} alt={narrator.name} fill sizes="168px" className="object-contain" />
          </div>
        ) : null}
      </div>

      {/* Headline + subtitle */}
      <div className="relative flex max-w-[680px] flex-col items-center gap-6 text-center">
        <h1
          className="text-[32px] leading-[1.4] text-black md:text-[44px] md:leading-[1.55]"
          style={{ fontFamily: "var(--font-chelsea-market)" }}
        >
          Congrats! You finished reading 🎉{" "}
          <span className="text-[#f29337]">{storyTitle}.</span>
        </h1>
        <p
          className="text-[20px] text-[#8a8a8a] md:text-[26px]"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          This story will be saved to your Library.
        </p>
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="relative flex items-center justify-center rounded-[48px] bg-[#f09237] px-12 py-[26px] text-white shadow-[4px_8px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.03] active:translate-y-[2px] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_rgba(0,0,0,0.1)]"
      >
        <span className="font-grandstander text-[22px] font-medium md:text-[26px]">Continue</span>
      </button>
    </main>
  );
}
