import { NextRequest } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { resolveVoiceId } from "../../lib/elevenlabs";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(req: NextRequest) {
  const { text, narrator, voiceId: customVoiceId } = (await req.json()) as {
    text: string;
    narrator?: string;
    voiceId?: string;
  };

  const voiceId = resolveVoiceId(narrator ?? "mouse", customVoiceId);

  const audioStream = await client.textToSpeech.stream(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  return new Response(audioStream, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
