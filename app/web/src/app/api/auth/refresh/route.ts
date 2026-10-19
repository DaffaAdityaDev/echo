import { cookies } from "next/headers";
import { getBackendApiUrl } from "@/constants/api";
import { authSessionResponse } from "@/lib/auth-session-response";
import { REFRESH_COOKIE } from "@/lib/session-cookies";

const BASE_URL = getBackendApiUrl();

export async function POST() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value ?? "";

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  return authSessionResponse(res, await res.text());
}
