"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClapToBegin } from "../components/clap-to-begin";

const REQUIRED_CLAPS = 2;
const VOLUME_THRESHOLD = 0.4;
const DEBOUNCE_MS = 250;

export default function ClapPreview() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let rafId: number | undefined;
    let lastClapAt = 0;
    let clapCount = 0;

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

          if (peak > VOLUME_THRESHOLD) {
            const now = Date.now();
            if (now - lastClapAt > DEBOUNCE_MS) {
              lastClapAt = now;
              clapCount += 1;
              if (clapCount >= REQUIRED_CLAPS) {
                cleanup();
                router.push("/");
                return;
              }
            }
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
