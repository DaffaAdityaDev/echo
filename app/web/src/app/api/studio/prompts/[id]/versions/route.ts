import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

type PromptParams = { params: Promise<{ id: string }> };

async function versionsPath(params: PromptParams["params"]): Promise<string> {
  const { id } = await params;

  return `/studio/prompts/${encodeURIComponent(id)}/versions`;
}

export async function GET(_req: NextRequest, { params }: PromptParams) {
  return proxyToBackend(await versionsPath(params));
}

export async function POST(req: NextRequest, { params }: PromptParams) {
  return proxyToBackend(await versionsPath(params), "POST", await readJsonBody(req));
}
