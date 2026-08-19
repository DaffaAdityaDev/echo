import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const token = await getRequestToken();
  const { id, version } = await params;
  return proxyFetch(`${BASE_URL}/studio/prompts/${id}/rollback/${version}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}
