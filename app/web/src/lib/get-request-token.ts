import { cookies, headers } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/session-cookies";

export async function getRequestToken(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACCESS_COOKIE)?.value;

  if (fromCookie) return fromCookie;

  const headersList = await headers();
  const authHeader = headersList.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return "";
}
