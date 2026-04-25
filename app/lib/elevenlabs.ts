import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

const VOICE_IDS: Record<string, string | undefined> = {
  mouse: process.env.ELEVENLABS_MOUSE_VOICE_ID,
  rabbit: process.env.ELEVENLABS_RABBIT_VOICE_ID,
  owl: process.env.ELEVENLABS_OWL_VOICE_ID,
};

export function resolveVoiceId(narrator: string): string {
  return VOICE_IDS[narrator] ?? process.env.ELEVENLABS_MOUSE_VOICE_ID!;
}

export async function generateAudio(text: string, voiceId: string): Promise<string> {
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  // ElevenLabs SDK returns a ReadableStream in Next.js edge/node environments
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return `data:audio/mpeg;base64,${Buffer.concat(chunks).toString("base64")}`;
}
