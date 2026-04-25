import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    event?: string;
    detail?: string;
    ts?: string;
  };

  const ts = body.ts ?? new Date().toISOString();
  const event = body.event ?? "unknown_event";
  const detail = body.detail ?? "";

  console.log(`[landing-debug][${ts}] ${event}${detail ? ` :: ${detail}` : ""}`);

  return Response.json({ ok: true });
}
