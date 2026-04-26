import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(req: NextRequest) {
  const { text, voice_id } = (await req.json()) as {
    text?: string;
    voice_id?: string;
  };

  if (!text || !voice_id) {
    return NextResponse.json(
      { error: "text and voice_id are required" },
      { status: 400 }
    );
  }

  const audioStream = await client.textToSpeech.stream(voice_id, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  return new Response(audioStream, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
