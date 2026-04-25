import { NextRequest } from "next/server";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const defaultAgentId = process.env.ELEVENLABS_AGENT_ID;
  const narratorAgentIds = {
    fox: process.env.ELEVENLABS_AGENT_ID_FOX,
    owl: process.env.ELEVENLABS_AGENT_ID_OWL,
    bear: process.env.ELEVENLABS_AGENT_ID_BEAR,
  } as const;

  if (!apiKey) {
    return Response.json(
      { error: "Missing ELEVENLABS_API_KEY in environment." },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    narratorId?: "fox" | "owl" | "bear";
  };

  const agentId =
    body.agentId?.trim() ||
    (body.narratorId ? narratorAgentIds[body.narratorId]?.trim() : undefined) ||
    defaultAgentId?.trim();

  if (!agentId) {
    return Response.json(
      {
        error:
          "Missing agentId. Provide it in body, narratorId mapping env, or ELEVENLABS_AGENT_ID.",
      },
      { status: 400 }
    );
  }

  const query = new URLSearchParams({ agent_id: agentId });
  const signedUrlResponse = await fetch(
    `${ELEVENLABS_API_BASE}/convai/conversation/get-signed-url?${query.toString()}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
      cache: "no-store",
    }
  );

  if (!signedUrlResponse.ok) {
    const detail = await signedUrlResponse.text();
    return Response.json(
      { error: "Failed to create signed URL.", detail },
      { status: signedUrlResponse.status }
    );
  }

  const payload = (await signedUrlResponse.json()) as { signed_url?: string };

  if (!payload.signed_url) {
    return Response.json(
      { error: "ElevenLabs response missing signed_url." },
      { status: 502 }
    );
  }

  return Response.json({
    signedUrl: payload.signed_url,
    agentId,
  });
}
