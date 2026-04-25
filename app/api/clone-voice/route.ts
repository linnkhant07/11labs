import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing ELEVENLABS_API_KEY in environment." },
      { status: 500 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return Response.json(
      { error: "Invalid multipart/form-data body." },
      { status: 400 }
    );
  }

  const audio = incoming.get("audio");
  const nameField = incoming.get("name");
  const name =
    typeof nameField === "string" && nameField.trim().length > 0
      ? nameField.trim()
      : `study-buddy-${Date.now()}`;

  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json(
      { error: "Missing or empty audio file in 'audio' field." },
      { status: 400 }
    );
  }

  const upstream = new FormData();
  upstream.append("name", name);
  upstream.append("files", audio, "buddy.webm");

  const response = await fetch(`${ELEVENLABS_API_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: upstream,
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: "Voice clone failed.", detail },
      { status: response.status }
    );
  }

  const data = (await response.json()) as { voice_id?: string };
  if (!data.voice_id) {
    return Response.json(
      { error: "ElevenLabs response missing voice_id." },
      { status: 502 }
    );
  }

  return Response.json({ voiceId: data.voice_id, name });
}
