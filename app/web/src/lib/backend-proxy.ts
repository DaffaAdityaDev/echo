import type { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";
import { proxyEventStream } from "@/lib/proxy-stream";

type BackendMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const BASE_URL = getBackendApiUrl();

async function authorizedHeaders(): Promise<HeadersInit> {
  const token = await getRequestToken();

  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function readJsonBody(req: NextRequest): Promise<string> {
  return JSON.stringify(await req.json());
}

// proxyToBackend forwards an authenticated JSON call to the Go gateway;
// path is relative to the /api/v1 base and must already be URL-encoded.
export async function proxyToBackend(path: string, method: BackendMethod = "GET", body?: string): Promise<NextResponse> {
  return proxyFetch(`${BASE_URL}${path}`, { method, headers: await authorizedHeaders(), body });
}

// proxyStreamToBackend relays an authenticated SSE POST, forwarding the JSON
// request body and aborting upstream when the client disconnects.
export async function proxyStreamToBackend(
  path: string,
  req: NextRequest,
  forwardHeaders: readonly string[] = [],
): Promise<Response> {
  return proxyEventStream(
    `${BASE_URL}${path}`,
    { method: "POST", headers: await authorizedHeaders(), body: await readJsonBody(req), signal: req.signal },
    forwardHeaders,
  );
}
