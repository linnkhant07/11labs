import Image from "next/image";

const ABSTRACT_SHAPES = [
  { src: "/figma/clap/abstract-211.svg", size: 128, left: "11%", top: "34%", rotate: 26.41 },
  { src: "/figma/clap/abstract-210.svg", size: 128, right: "15%", top: "48%", rotate: -18.1 },
  { src: "/figma/clap/abstract-212.svg", size: 89, left: "5%", top: "50%", rotate: -26.87 },
  { src: "/figma/clap/abstract-208.svg", size: 64, right: "28%", top: "45%", rotate: -111.96 },
  { src: "/figma/clap/abstract-209.svg", size: 44, right: "25%", top: "36%", rotate: -65.86 },
] as const;

export function ClapToBegin() {
  return (
    <div
      className="relative flex w-full flex-col items-center justify-center gap-[120px] overflow-hidden bg-gradient-to-b from-[#fcebdc] to-[#fbfffd] px-8 py-20"
      style={{ zoom: 0.75, minHeight: "calc(100vh / 0.9)" }}
    >
      {ABSTRACT_SHAPES.map((shape, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={shape.src}
          alt=""
          aria-hidden
          className="pointer-events-none absolute"
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

      <div className="relative flex size-[clamp(300px,40vw,540px)] shrink-0 items-center justify-center overflow-clip rounded-full bg-[#ffeeca] p-14 shadow-[2px_2px_80px_0px_#f09237]">
        <div className="relative size-[66.6%]">
          <Image
            src="/figma/clap/fox.png"
            alt="Friendly fox narrator"
            fill
            sizes="360px"
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-9 text-center">
        <h1
          className="text-[clamp(56px,8vw,80px)] leading-none"
          style={{ fontFamily: "var(--font-chelsea-market)" }}
        >
          <span className="text-[#f29337]">QueSt</span>
          <span className="text-black">ory</span>
        </h1>
        <p
          className="italic text-[clamp(20px,3vw,40px)] text-[#585858]"
          style={{ fontFamily: "var(--font-nunito), sans-serif", fontWeight: 500 }}
        >
          Learning made easy for students with ADHD.
        </p>
      </div>
    </div>
  );
}
