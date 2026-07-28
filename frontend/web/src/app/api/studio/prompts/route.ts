import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(req: NextRequest) {
  const token = await getRequestToken();
  return proxyFetch(`${BASE_URL}/studio/prompts`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const token = await getRequestToken();
  const body = await req.json();
  return proxyFetch(`${BASE_URL}/studio/prompts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
