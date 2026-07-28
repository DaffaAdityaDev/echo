import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(req: NextRequest) {
  const token = await getRequestToken();
  const name = req.nextUrl.searchParams.get("name");
  return proxyFetch(`${BASE_URL}/studio/prompts/active?name=${encodeURIComponent(name || "")}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}
