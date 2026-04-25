"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NARRATORS = [
  { id: "mouse", emoji: "\ud83d\udc2d", name: "Milo the Mouse", color: "from-gray-400 to-slate-500" },
  { id: "rabbit", emoji: "\ud83d\udc30", name: "Rosie the Rabbit", color: "from-pink-400 to-rose-500" },
  { id: "owl", emoji: "\ud83e\udd89", name: "Oliver the Owl", color: "from-indigo-400 to-purple-500" },
] as const;

const TOPICS = [
  { id: "tornadoes", emoji: "\ud83c\udf2a\ufe0f", name: "Tornadoes", available: true },
  { id: "pyramids", emoji: "\ud83d\udea7", name: "Pyramids", available: false },
] as const;

export default function Home() {
  const router = useRouter();
  const [narrator, setNarrator] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);

  function handleStart() {
    if (!narrator || !topic) return;
    router.push(`/story?topic=${topic}&narrator=${narrator}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 to-indigo-100 px-6 py-12">
      <div className="w-full max-w-2xl space-y-10">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-indigo-900">
            educ-ATE
          </h1>
          <p className="text-lg text-indigo-600">
            Pick a topic and a narrator to start your adventure!
          </p>
        </div>

        {/* Topic selection */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            What do you want to learn about?
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                disabled={!t.available}
                onClick={() => setTopic(t.id)}
                className={`relative rounded-2xl border-2 p-6 text-center transition-all ${
                  !t.available
                    ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                    : topic === t.id
                      ? "border-indigo-500 bg-indigo-50 shadow-lg scale-[1.02]"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                <span className="text-4xl">{t.emoji}</span>
                <p className="mt-2 font-semibold text-gray-800">{t.name}</p>
                {!t.available && (
                  <span className="absolute top-2 right-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Narrator selection */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Who should tell the story?
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {NARRATORS.map((n) => (
              <button
                key={n.id}
                onClick={() => setNarrator(n.id)}
                className={`rounded-2xl border-2 p-5 text-center transition-all ${
                  narrator === n.id
                    ? "border-indigo-500 bg-indigo-50 shadow-lg scale-[1.02]"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                <span className="text-5xl">{n.emoji}</span>
                <p className="mt-2 text-sm font-semibold text-gray-800">{n.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!narrator || !topic}
          className={`w-full rounded-full py-4 text-lg font-bold transition-all ${
            narrator && topic
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.01]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Your Adventure
        </button>
      </div>
    </div>
  );
}
