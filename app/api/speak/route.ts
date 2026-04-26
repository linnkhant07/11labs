import { NextRequest } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY;

const client = new ElevenLabsClient({
  apiKey,
});

const VOICE_MAP: Record<string, string | undefined> = {
  mouse: process.env.ELEVENLABS_MOUSE_VOICE_ID,
  rabbit: process.env.ELEVENLABS_RABBIT_VOICE_ID,
  owl: process.env.ELEVENLABS_OWL_VOICE_ID,
};

export async function POST(req: NextRequest) {
  if (!apiKey) {
    return Response.json(
      { error: "Missing ELEVENLABS_API_KEY in environment." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as { text?: string; narrator?: string };
  const text = body.text?.trim();

  if (!text) {
    return Response.json(
      { error: "Request body must include a non-empty text field." },
      { status: 400 }
    );
  }

  const resolvedVoiceId =
    (body.narrator && VOICE_MAP[body.narrator]) ||
    process.env.ELEVENLABS_MOUSE_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_ID;

  if (!resolvedVoiceId) {
    return Response.json(
      { error: "No voice id configured. Set ELEVENLABS_VOICE_ID or per-narrator env vars." },
      { status: 500 }
    );
  }

  const audioStream = await client.textToSpeech.stream(resolvedVoiceId, {
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
