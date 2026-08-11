import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";

const BASE_URL = getBackendApiUrl();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken();
  const { id } = await params;

  const upstream = await fetch(`${BASE_URL}/sessions/${id}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return new Response(errorText, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}
