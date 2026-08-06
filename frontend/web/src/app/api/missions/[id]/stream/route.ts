import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";

const BASE_URL = getBackendApiUrl();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken();
  const { id } = await params;
  const after = req.nextUrl.searchParams.get("after");

  const upstream = await fetch(`${BASE_URL}/missions/${id}/stream${after ? `?after=${after}` : ""}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/event-stream",
      Accept: "text/event-stream",
    },
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
