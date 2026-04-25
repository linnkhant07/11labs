import { NextRequest } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text: string };

  const audioStream = await client.textToSpeech.stream(
    process.env.ELEVENLABS_VOICE_ID!,
    {
      text,
      modelId: "eleven_flash_v2_5",
      outputFormat: "mp3_44100_128",
    }
  );

  return new Response(audioStream, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
