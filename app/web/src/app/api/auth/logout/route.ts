import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { clearSessionCookies, REFRESH_COOKIE } from "@/lib/session-cookies";

const BASE_URL = getBackendApiUrl();

export async function POST() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value ?? "";

  // Revocation is best-effort: the cookies are cleared regardless so the
  // client can never get stuck in a logged-out state.
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {
    // ignore: the backend may be unreachable, cookies still clear below
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
