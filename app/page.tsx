"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NARRATORS = [
  { id: "mouse", emoji: "\ud83d\udc2d", name: "Milo the Mouse" },
  { id: "rabbit", emoji: "\ud83d\udc30", name: "Rosie the Rabbit" },
  { id: "owl", emoji: "\ud83e\udd89", name: "Oliver the Owl" },
] as const;

const SUGGESTED_TOPICS = [
  { emoji: "\ud83c\udf2a\ufe0f", name: "Tornadoes" },
  { emoji: "\ud83d\udea7", name: "Pyramids" },
  { emoji: "\ud83c\udf0b", name: "Volcanoes" },
  { emoji: "\ud83e\udd96", name: "Dinosaurs" },
  { emoji: "\ud83d\ude80", name: "Space" },
  { emoji: "\ud83c\udf0a", name: "Ocean" },
];

export default function Home() {
  const router = useRouter();
  const [narrator, setNarrator] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  function handleStart() {
    if (!narrator || !topic.trim()) return;
    const params = new URLSearchParams({
      topic: topic.trim(),
      narrator,
    });
    router.push(`/story?${params.toString()}`);
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

        {/* Topic input */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            What do you want to learn about?
          </h2>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Type anything... tornadoes, dinosaurs, black holes..."
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-lg text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-indigo-400 focus:shadow-md"
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t.name}
                onClick={() => setTopic(t.name)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                  topic === t.name
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                }`}
              >
                {t.emoji} {t.name}
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
          disabled={!narrator || !topic.trim()}
          className={`w-full rounded-full py-4 text-lg font-bold transition-all ${
            narrator && topic.trim()
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
