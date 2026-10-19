import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

export async function GET() {
  return proxyToBackend("/api-keys");
}

export async function POST(req: NextRequest) {
  return proxyToBackend("/api-keys", "POST", await readJsonBody(req));
}
