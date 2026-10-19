import type { NextRequest } from "next/server";
import { proxyStreamToBackend } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  return proxyStreamToBackend("/chat", req, ["X-Session-ID"]);
}
