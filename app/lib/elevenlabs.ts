import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

const VOICE_IDS: Record<string, string | undefined> = {
  mouse: process.env.ELEVENLABS_MOUSE_VOICE_ID,
  rabbit: process.env.ELEVENLABS_RABBIT_VOICE_ID,
  owl: process.env.ELEVENLABS_OWL_VOICE_ID,
};

export function resolveVoiceId(narrator: string, customVoiceId?: string): string {
  if (customVoiceId) return customVoiceId;
  return VOICE_IDS[narrator] ?? process.env.ELEVENLABS_MOUSE_VOICE_ID!;
}

let audioCounter = 0;

export async function generateAudio(text: string, voiceId: string, label?: string): Promise<string> {
  const id = ++audioCounter;
  const tag = label ? `[elevenlabs] Audio #${id} (${label})` : `[elevenlabs] Audio #${id}`;
  console.log(`${tag} — starting... (${text.length} chars)`);
  const t0 = Date.now();

  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  console.log(`${tag} — done in ${((Date.now() - t0) / 1000).toFixed(1)}s (${Math.round(buffer.length / 1024)}KB)`);
  return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export async function generateAudioWithTimestamps(
  text: string,
  voiceId: string,
  label?: string
): Promise<{ audioUrl: string; timestamps: WordTimestamp[] }> {
  const id = ++audioCounter;
  const tag = label ? `[elevenlabs] Audio+TS #${id} (${label})` : `[elevenlabs] Audio+TS #${id}`;
  console.log(`${tag} — starting... (${text.length} chars)`);
  const t0 = Date.now();

  const response = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  const data = response as unknown as { audioBase64: string; alignment?: { characters: string[]; characterStartTimesSeconds: number[]; characterEndTimesSeconds: number[] } };
  const audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;

  // Convert character-level alignment to word-level timestamps
  const timestamps: WordTimestamp[] = [];
  const alignment = data.alignment;
  if (alignment) {
    const chars = alignment.characters;
    const starts = alignment.characterStartTimesSeconds;
    const ends = alignment.characterEndTimesSeconds;
    let wordStart = 0;
    let currentWord = "";

    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === " " || chars[i] === "\n") {
        if (currentWord) {
          timestamps.push({ word: currentWord, start: starts[wordStart], end: ends[i - 1] });
          currentWord = "";
        }
        wordStart = i + 1;
      } else {
        if (!currentWord) wordStart = i;
        currentWord += chars[i];
      }
    }
    if (currentWord) {
      timestamps.push({ word: currentWord, start: starts[wordStart], end: ends[chars.length - 1] });
    }
  }

  console.log(`${tag} — done in ${((Date.now() - t0) / 1000).toFixed(1)}s (${timestamps.length} words)`);
  return { audioUrl, timestamps };
}
