import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; v: string }> }) {
  const token = await getRequestToken();
  const { id, v } = await params;
  return proxyFetch(`${BASE_URL}/studio/prompts/${id}/versions/${v}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}
