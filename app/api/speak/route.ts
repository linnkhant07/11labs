import { NextRequest } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const VOICE_MAP: Record<string, string | undefined> = {
  mouse: process.env.ELEVENLABS_MOUSE_VOICE_ID,
  rabbit: process.env.ELEVENLABS_RABBIT_VOICE_ID,
  owl: process.env.ELEVENLABS_OWL_VOICE_ID,
};

export async function POST(req: NextRequest) {
  const { text, narrator } = (await req.json()) as {
    text: string;
    narrator?: string;
  };

  const voiceId =
    (narrator && VOICE_MAP[narrator]) ||
    process.env.ELEVENLABS_MOUSE_VOICE_ID!;

  const audioStream = await client.textToSpeech.stream(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  return new Response(audioStream, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
