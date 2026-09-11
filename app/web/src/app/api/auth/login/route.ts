import { type NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { setSessionCookies } from "@/lib/session-cookies";

const BASE_URL = getBackendApiUrl();

interface AuthResponsePayload {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
  error?: string;
  message?: string;
}

function isString(val: unknown): val is string {
  return typeof val === "string";
}

function isAuthPayload(val: unknown): val is AuthResponsePayload {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function parseAuthPayload(text: string): AuthResponsePayload {
  try {
    const parsed: unknown = JSON.parse(text);

    if (isAuthPayload(parsed)) {
      return parsed;
    }

    return { error: text || "Invalid response from server" };
  } catch {
    return { error: text || "Invalid response from server" };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = parseAuthPayload(text);

  // The tokens are transported exclusively via httpOnly cookies below; never
  // expose them in the JSON body returned to the client.
  let access: string | undefined;
  let refresh: string | undefined;

  if (res.ok && isString(data.access_token)) {
    access = data.access_token;
    refresh = isString(data.refresh_token) ? data.refresh_token : undefined;
    delete data.access_token;
    delete data.refresh_token;
  }

  const response = NextResponse.json(data, { status: res.status });

  if (access && refresh) {
    setSessionCookies(response, access, refresh);
  }

  return response;
}
