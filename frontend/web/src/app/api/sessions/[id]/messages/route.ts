import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken();
  const { id } = await params;
  const searchParams = req.nextUrl.search;
  return proxyFetch(`${BASE_URL}/sessions/${id}/messages${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
