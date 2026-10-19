import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return proxyToBackend(`/sessions/${encodeURIComponent(id)}/messages${req.nextUrl.search}`);
}
