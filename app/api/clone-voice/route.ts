import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  try {
    const response = await client.voices.ivc.create({
      files: [audioFile],
      name: `parent-voice-${Date.now()}`,
      removeBackgroundNoise: true,
      description: "Parent voice clone for QueStory storybook",
    });

    return NextResponse.json({ voiceId: response.voiceId });
  } catch (err) {
    console.error("Voice cloning failed:", err);
    return NextResponse.json(
      { error: "Voice cloning failed. Please try again." },
      { status: 500 }
    );
  }
}
