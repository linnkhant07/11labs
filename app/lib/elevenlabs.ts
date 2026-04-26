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
