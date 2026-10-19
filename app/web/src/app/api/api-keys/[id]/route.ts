import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return proxyToBackend(`/api-keys/${encodeURIComponent(id)}`, "DELETE");
}
