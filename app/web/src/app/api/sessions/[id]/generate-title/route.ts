import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return proxyToBackend(`/sessions/${encodeURIComponent(id)}/generate-title`, "POST", await readJsonBody(req));
}
