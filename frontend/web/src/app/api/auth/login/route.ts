import { type NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/constants/api";

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

  const response = NextResponse.json(data, { status: res.status });

  if (res.ok && typeof data.token === "string") {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    };
    response.cookies.set("auth_token", data.token, cookieOptions);
  }

  return response;
}
