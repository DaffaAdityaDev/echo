import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";

const BASE_URL = getBackendApiUrl();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken();
  const { id } = await params;
  const body = await req.json();

  const upstream = await fetch(`${BASE_URL}/sessions/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return new Response(errorText, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  }

  return new Response(
    upstream.body ??
      new ReadableStream({
        start(c) {
          c.close();
        },
      }),
    {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
