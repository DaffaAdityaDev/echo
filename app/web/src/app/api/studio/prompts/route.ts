import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

export async function GET() {
  return proxyToBackend("/studio/prompts");
}

export async function POST(req: NextRequest) {
  return proxyToBackend("/studio/prompts", "POST", await readJsonBody(req));
}
