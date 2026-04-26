"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { NewStoryChat } from "../components/new-story-chat";

type Category = {
  id: string;
  name: string;
  emoji: string;
};

const CATEGORIES: Category[] = [
  { id: "science", name: "Science", emoji: "🌱" },
  { id: "history", name: "History", emoji: "🏛️" },
];

export default function NewStory() {
  const router = useRouter();
  const params = useSearchParams();
  const narrator = params.get("narrator") ?? "fox";

  function pick(category: Category) {
    const next = new URLSearchParams({ narrator, category: category.id });
    router.push(`/new-story/topic?${next.toString()}`);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#fcebdc] to-white">
      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        aria-label="Go back"
        className="absolute left-6 top-6 z-10 flex size-16 items-center justify-center rounded-full border border-white bg-white shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 md:left-10 md:top-10 md:size-20"
      >
        <ArrowLeftIcon />
      </button>

      {/* Decorative leaves */}
      <DecorLeaf
        src="/figma/category/leaf-4.svg"
        size={128}
        rotate={26.41}
        className="left-[15%] top-[55%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/category/leaf-5.svg"
        size={89}
        rotate={-26.87}
        className="left-[7%] top-[72%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/category/leaf-6.svg"
        size={128}
        rotate={-18.1}
        className="right-[5%] top-[68%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/category/leaf-7.svg"
        size={64}
        rotate={-111.96}
        className="right-[18%] top-[62%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/category/leaf-8.svg"
        size={44}
        rotate={-65.86}
        className="right-[12%] top-[50%] hidden md:block"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1280px] flex-col items-center justify-center gap-14 px-6 py-20 md:px-20">
        <h1 className="font-chelsea text-center text-[32px] text-black md:text-[44px]">
          I want to learn about...
        </h1>

        <div className="flex flex-col gap-7 sm:flex-row">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className="flex h-[360px] w-[260px] flex-col items-center justify-center gap-5 overflow-hidden rounded-[16px] bg-white px-12 shadow-[2px_2px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.03] focus:outline-none md:h-[448px] md:w-[317px]"
            >
              <span className="text-[52px] leading-none md:text-[60px]">
                {c.emoji}
              </span>
              <span
                className="text-center text-[28px] font-semibold text-black md:text-[32px]"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <NewStoryChat />
    </main>
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
      <Image src={src} alt="" fill sizes="128px" className="object-contain" />
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <div className="relative size-9 overflow-hidden md:size-10">
      <div className="absolute inset-[16.67%_45.83%_16.67%_16.67%]">
        <img src="/figma/category/arrow-1.svg" alt="" className="size-full" />
      </div>
      <div className="absolute inset-[45.83%_16.67%]">
        <img src="/figma/category/arrow-2.svg" alt="" className="size-full" />
      </div>
    </div>
  );
}
