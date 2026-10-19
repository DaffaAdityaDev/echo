import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");

  return proxyToBackend(`/studio/prompts/active?name=${encodeURIComponent(name || "")}`);
}
