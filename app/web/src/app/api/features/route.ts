import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(_req: NextRequest) {
  const token = await getRequestToken();
  return proxyFetch(`${BASE_URL}/features`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
