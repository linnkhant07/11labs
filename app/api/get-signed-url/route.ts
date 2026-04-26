import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get("role");
    const agentId =
      role === "narrator"
        ? process.env.NEXT_PUBLIC_ELEVENLABS_NARRATOR_AGENT_ID ||
          process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID
        : process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    console.log("[get-signed-url] request", { role: role ?? "default", agentId });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[get-signed-url] success", { role: role ?? "default", agentId });
    return NextResponse.json({
      signedUrl: data.signed_url,
      role: role ?? "default",
      agentId,
    });
  } catch (error) {
    console.error("Failed to get signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
