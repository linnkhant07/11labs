"use client";

import { FormEvent, useState } from "react";

export default function SpeakTestPage() {
  const [text, setText] = useState("hello");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unknown error";
      setError(message);
      setAudioUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Speak API Test</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="text" className="text-sm font-medium">
          Text to synthesize
        </label>
        <textarea
          id="text"
          className="min-h-28 rounded border p-3"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isLoading ? "Generating..." : "Generate audio"}
        </button>
      </form>

      {error ? <p className="text-red-600">{error}</p> : null}
      {audioUrl ? <audio controls src={audioUrl} className="w-full" /> : null}
    </main>
  );
}
