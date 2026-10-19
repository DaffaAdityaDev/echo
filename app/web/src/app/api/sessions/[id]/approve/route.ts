import type { NextRequest } from "next/server";
import { proxyStreamToBackend } from "@/lib/backend-proxy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return proxyStreamToBackend(`/sessions/${encodeURIComponent(id)}/approve`, req);
}
