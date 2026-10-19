import { NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/session-cookies";

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

// authSessionResponse relays a gateway login/refresh reply. The tokens are
// transported exclusively via httpOnly cookies; they are stripped from the
// JSON body returned to the client.
export function authSessionResponse(upstream: Response, text: string): NextResponse {
  const data = parseAuthPayload(text);
  let access: string | undefined;
  let refresh: string | undefined;

  if (upstream.ok && isString(data.access_token)) {
    access = data.access_token;
    refresh = isString(data.refresh_token) ? data.refresh_token : undefined;
    delete data.access_token;
    delete data.refresh_token;
  }

  const response = NextResponse.json(data, { status: upstream.status });

  if (access && refresh) {
    setSessionCookies(response, access, refresh);
  }

  return response;
}
