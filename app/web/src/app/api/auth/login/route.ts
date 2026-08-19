import { type NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { setSessionCookies } from "@/lib/session-cookies";

const BASE_URL = getBackendApiUrl();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text || "Invalid response from server" };
  }

  // The tokens are transported exclusively via httpOnly cookies below; never
  // expose them in the JSON body returned to the client.
  let access: string | undefined;
  let refresh: string | undefined;
  if (res.ok && typeof data.access_token === "string") {
    access = data.access_token;
    refresh = typeof data.refresh_token === "string" ? data.refresh_token : undefined;
    delete data.access_token;
    delete data.refresh_token;
  }

  const response = NextResponse.json(data, { status: res.status });

  if (access && refresh) {
    setSessionCookies(response, access, refresh);
  }

  return response;
}
