import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; v: string }> }) {
  const { id, v } = await params;

  return proxyToBackend(`/studio/prompts/${encodeURIComponent(id)}/versions/${encodeURIComponent(v)}`);
}
