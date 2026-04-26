"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PASSAGE_LEAD = "When the sunlight strikes raindrops in the air,";
const PASSAGE_REST =
  " they act like a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. There is, according to legend, a boiling pot of gold at one end. People look but no one ever finds it.";

export default function RecordVoice() {
  const router = useRouter();
  const [name, setName] = useState("Mommy");

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#fcebdc] to-[#fbfffd]">
      {/* Decorative leaves */}
      <DecorLeaf
        src="/figma/landing/leaf-1.svg"
        size={91}
        rotate={26.41}
        className="right-[3%] top-[7%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/landing/leaf-2.svg"
        size={63}
        rotate={-101.7}
        className="right-[8%] top-[4%] hidden md:block"
      />
      <DecorLeaf
        src="/figma/landing/leaf-3.svg"
        size={77}
        rotate={18.88}
        className="left-[2%] top-[42%] hidden md:block"
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-14 px-6 py-12 md:px-16 md:py-20 lg:px-24">
        {/* Header */}
        <div className="flex items-center gap-6 md:gap-10">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex size-16 items-center justify-center rounded-full border border-white bg-white shadow-[2px_2px_5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 md:size-20"
          >
            <ArrowLeftIcon />
          </button>
          <h1 className="font-chelsea text-[32px] text-black md:text-[44px]">
            Record a Voice
          </h1>
        </div>

        {/* Card */}
        <section className="flex w-full flex-col gap-10 rounded-[24px] bg-white p-6 shadow-[2px_2px_5px_rgba(0,0,0,0.1)] md:gap-12 md:p-10">
          {/* Upload Icon */}
          <div className="flex flex-col gap-6">
            <label className="font-grandstander text-[22px] font-medium text-black md:text-[26px]">
              Upload Icon
            </label>
            <button
              type="button"
              aria-label="Upload icon"
              className="flex size-[120px] items-center justify-center overflow-hidden rounded-full bg-[#e1e1e1] transition-transform hover:scale-105"
            >
              <ImagePlusIcon />
            </button>
          </div>

          {/* Name */}
          <div className="flex w-full max-w-[604px] flex-col gap-4">
            <label
              htmlFor="voice-name"
              className="font-grandstander text-[24px] font-medium text-black md:text-[28px]"
            >
              Name
            </label>
            <input
              id="voice-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[6px] border border-[#cfcfcf] bg-white p-[14px] text-[20px] font-semibold text-black shadow-[2px_2px_1px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-2 focus:ring-[#f29337]"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            />
          </div>

          {/* Passage */}
          <div className="flex flex-col gap-8">
            <p className="font-grandstander text-[24px] font-medium text-black md:text-[28px]">
              Read the following passage:
            </p>
            <button
              type="button"
              className="flex items-center justify-center gap-6 self-start rounded-full bg-[#f09237] px-10 py-[22px] shadow-[2px_8px_0px_0px_#db6c00,2px_2px_20px_0px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.03] active:translate-y-[2px] active:shadow-[2px_4px_0px_0px_#db6c00,2px_2px_20px_0px_rgba(0,0,0,0.1)]"
            >
              <MicIcon />
              <span className="font-grandstander text-[26px] font-medium text-white">
                Record
              </span>
            </button>
            <p
              className="text-[20px] leading-[40px] text-[#585858] md:text-[24px] md:leading-[48px]"
              style={{ fontFamily: "var(--font-abeezee), sans-serif" }}
            >
              <span className="text-[#f29337]">{PASSAGE_LEAD}</span>
              {PASSAGE_REST}
            </p>
          </div>
        </section>
      </div>
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
      <Image src={src} alt="" fill sizes="100px" className="object-contain" />
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

function MicIcon() {
  return (
    <div className="relative size-7 overflow-hidden">
      <div className="absolute inset-[4.17%_33.33%_33.33%_33.33%]">
        <img src="/figma/landing/mic-1.svg" alt="" className="size-full" />
      </div>
      <div className="absolute inset-[37.5%_16.67%_16.67%_16.67%]">
        <img src="/figma/landing/mic-2.svg" alt="" className="size-full" />
      </div>
      <div className="absolute bottom-[4.17%] left-[45.83%] right-[45.83%] top-3/4">
        <img src="/figma/landing/mic-3.svg" alt="" className="size-full" />
      </div>
    </div>
  );
}

function ImagePlusIcon() {
  return (
    <div className="relative size-8 overflow-hidden">
      <div className="absolute bottom-3/4 left-[62.5%] right-[4.17%] top-[16.67%]">
        <img src="/figma/record-voice/image-plus-1.svg" alt="" className="size-full" />
      </div>
      <div className="absolute bottom-[62.5%] left-3/4 right-[16.67%] top-[4.17%]">
        <img src="/figma/record-voice/image-plus-2.svg" alt="" className="size-full" />
      </div>
      <div className="absolute inset-[8.33%]">
        <img src="/figma/record-voice/image-plus-3.svg" alt="" className="size-full" />
      </div>
      <div className="absolute inset-[43.04%_8.33%_8.33%_20.83%]">
        <img src="/figma/record-voice/image-plus-4.svg" alt="" className="size-full" />
      </div>
      <div className="absolute bottom-1/2 left-1/4 right-1/2 top-1/4">
        <img src="/figma/record-voice/image-plus-5.svg" alt="" className="size-full" />
      </div>
    </div>
  );
}
