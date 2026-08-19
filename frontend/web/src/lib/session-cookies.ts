import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "auth_token";
export const REFRESH_COOKIE = "refresh_token";

export const ACCESS_COOKIE_TTL = 15 * 60; // seconds — matches the access token TTL
export const REFRESH_COOKIE_TTL = 30 * 24 * 60 * 60; // seconds — matches the refresh token TTL

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookies(response: NextResponse, access: string, refresh: string): void {
  response.cookies.set(ACCESS_COOKIE, access, { ...BASE_OPTIONS, maxAge: ACCESS_COOKIE_TTL });
  response.cookies.set(REFRESH_COOKIE, refresh, { ...BASE_OPTIONS, maxAge: REFRESH_COOKIE_TTL });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...BASE_OPTIONS, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...BASE_OPTIONS, maxAge: 0 });
}
