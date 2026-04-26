"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClapToBegin } from "./components/clap-to-begin";

// Tuned for noisy hackathon rooms — only strong, transient claps trigger.
const REQUIRED_CLAPS = 2;
const VOLUME_THRESHOLD = 0.85;        // absolute peak floor (0..1)
const BASELINE_RATIO = 4;             // peak must be this many times the rolling noise floor
const DEBOUNCE_MS = 400;              // gap between counted claps (handles echoes)
const BASELINE_WINDOW = 60;           // frames feeding the rolling baseline

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let rafId: number | undefined;
    let lastClapAt = 0;
    let clapCount = 0;
    const baseline: number[] = [];

    function cleanup() {
      if (cancelled) return;
      cancelled = true;
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          cleanup();
          return;
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);

        function tick() {
          if (cancelled) return;
          analyser.getFloatTimeDomainData(buffer);

          let peak = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = Math.abs(buffer[i]);
            if (v > peak) peak = v;
          }

          // Rolling noise floor — average of recent NON-clap frames.
          const floor = baseline.length
            ? baseline.reduce((a, b) => a + b, 0) / baseline.length
            : 0;
          const isClap =
            peak > VOLUME_THRESHOLD && peak > floor * BASELINE_RATIO;

          if (isClap) {
            const now = Date.now();
            if (now - lastClapAt > DEBOUNCE_MS) {
              lastClapAt = now;
              clapCount += 1;
              if (clapCount >= REQUIRED_CLAPS) {
                cleanup();
                router.push("/library");
                return;
              }
            }
          } else {
            // Only feed the baseline when the frame isn't a clap, otherwise
            // sustained applause would raise the floor above future claps.
            baseline.push(peak);
            if (baseline.length > BASELINE_WINDOW) baseline.shift();
          }

          rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);
      } catch (err) {
        console.error("[clap] mic permission failed:", err);
      }
    }

    start();

    return cleanup;
  }, [router]);

  return <ClapToBegin />;
}
