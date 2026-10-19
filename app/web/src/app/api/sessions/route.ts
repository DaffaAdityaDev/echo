import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  return proxyToBackend(`/sessions${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return proxyToBackend("/sessions", "POST", await readJsonBody(req));
}
