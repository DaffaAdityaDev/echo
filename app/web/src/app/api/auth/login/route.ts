import { type NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { authSessionResponse } from "@/lib/auth-session-response";

const BASE_URL = getBackendApiUrl();

async function fetchLogin(body: string, signal: AbortSignal): Promise<{ res: Response; text: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });

    return { res, text: await res.text() };
  } catch (err: unknown) {
    console.error("[auth/login] Error reaching backend:", err);

    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await fetchLogin(JSON.stringify(body), req.signal);

  if (!upstream) {
    return NextResponse.json({ error: "Authentication service is unavailable" }, { status: 502 });
  }

  return authSessionResponse(upstream.res, upstream.text);
}
