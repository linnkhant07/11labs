import { NextRequest } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;

const client = new ElevenLabsClient({
  apiKey,
});

export async function POST(req: NextRequest) {
  if (!apiKey || !voiceId) {
    return Response.json(
      { error: "Missing ElevenLabs environment configuration." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return Response.json(
      { error: "Request body must include a non-empty text field." },
      { status: 400 }
    );
  }

  const audioStream = await client.textToSpeech.stream(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  });

  return new Response(audioStream, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}
