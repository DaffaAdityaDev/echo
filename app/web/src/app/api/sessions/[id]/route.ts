import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

type SessionParams = { params: Promise<{ id: string }> };

async function sessionPath(params: SessionParams["params"]): Promise<string> {
  const { id } = await params;

  return `/sessions/${encodeURIComponent(id)}`;
}

export async function GET(_req: NextRequest, { params }: SessionParams) {
  return proxyToBackend(await sessionPath(params));
}

export async function PATCH(req: NextRequest, { params }: SessionParams) {
  return proxyToBackend(await sessionPath(params), "PATCH", await readJsonBody(req));
}

export async function DELETE(_req: NextRequest, { params }: SessionParams) {
  return proxyToBackend(await sessionPath(params), "DELETE");
}
