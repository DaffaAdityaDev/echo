import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(req: NextRequest) {
  const token = await getRequestToken();
  return proxyFetch(`${BASE_URL}/skills`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
