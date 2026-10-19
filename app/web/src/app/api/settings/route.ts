import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

export async function GET() {
  return proxyToBackend("/settings");
}

export async function PUT(req: NextRequest) {
  return proxyToBackend("/settings", "PUT", await readJsonBody(req));
}
