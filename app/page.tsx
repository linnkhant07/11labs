"use client";

import { useState, useRef } from "react";
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
  const [demoMode, setDemoMode] = useState(true);

  // Voice cloning state
  const [cloning, setCloning] = useState(false);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function handleStart() {
    if (!narrator || !topic.trim()) return;
    const params = new URLSearchParams({
      topic: topic.trim(),
      narrator,
      ...(demoMode ? { demo: "1" } : {}),
      ...(narrator === "custom" && clonedVoiceId ? { voiceId: clonedVoiceId } : {}),
    });
    router.push(`/story?${params.toString()}`);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setRecording(true);
      setCloneError(null);
    } catch {
      setCloneError("Could not access microphone");
    }
  }

  async function stopRecordingAndClone() {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setCloning(true);
        setCloneError(null);

        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const res = await fetch("/api/clone-voice", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (!res.ok) throw new Error(data.error ?? "Cloning failed");

          setClonedVoiceId(data.voiceId);
          setNarrator("custom");
        } catch (err) {
          setCloneError(err instanceof Error ? err.message : "Cloning failed");
        } finally {
          setCloning(false);
        }
        resolve();
      };
      mediaRecorder.stop();
    });
  }

  const canStart = narrator && topic.trim() && (narrator !== "custom" || clonedVoiceId);

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

          {/* Voice cloning option */}
          <div
            className={`rounded-2xl border-2 p-5 transition-all ${
              narrator === "custom"
                ? "border-indigo-500 bg-indigo-50 shadow-lg"
                : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">{"🎙️"}</span>
                  Use Your Own Voice
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Record about 1 minute of reading and hear the story in your voice
                </p>
              </div>

              {clonedVoiceId ? (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <span>{"✓"}</span> Voice ready!
                </div>
              ) : cloning ? (
                <div className="flex items-center gap-2 text-sm text-indigo-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                  Cloning...
                </div>
              ) : recording ? (
                <button
                  onClick={stopRecordingAndClone}
                  className="rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 transition-all flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  Stop & Clone
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-bold text-white hover:shadow-lg transition-all"
                >
                  Start Recording
                </button>
              )}
            </div>

            {recording && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording... Read this aloud at a natural pace:
                </p>
                <p className="text-sm text-red-600 mt-2 italic leading-relaxed">
                  &ldquo;The sun set over the mountains, painting the sky in brilliant shades of orange
                  and purple. A cool breeze carried the scent of pine trees through the valley below.
                  In the distance, a river sparkled like a ribbon of silver, winding its way through
                  the thick green forest. Birds sang their evening songs as the first stars began to
                  appear in the darkening sky above.

                  Down by the river, a family of deer stepped carefully out of the trees to drink
                  the cool, clear water. The smallest fawn looked up at the sky with wide, curious eyes,
                  as if wondering where all the colors came from. A gentle owl hooted from a nearby branch,
                  watching over the forest as night slowly arrived.

                  Somewhere far away, a train whistle echoed through the hills, carrying travelers
                  to places they had only dreamed about. The world felt peaceful and full of wonder,
                  as if every creature and every star had found exactly where it was meant to be.&rdquo;
                </p>
              </div>
            )}

            {cloneError && (
              <p className="mt-2 text-sm text-red-600">{cloneError}</p>
            )}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full rounded-full py-4 text-lg font-bold transition-all ${
            canStart
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.01]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Your Adventure
        </button>

        {/* Demo mode toggle */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              demoMode ? "bg-indigo-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                demoMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-500">
            {demoMode ? "Demo mode (hardcoded, no credits)" : "Live mode (Gemini generation)"}
          </span>
        </div>
      </div>
    </div>
  );
}
