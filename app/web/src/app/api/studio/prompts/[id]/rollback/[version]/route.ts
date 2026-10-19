import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;

  return proxyToBackend(`/studio/prompts/${encodeURIComponent(id)}/rollback/${encodeURIComponent(version)}`, "POST");
}
