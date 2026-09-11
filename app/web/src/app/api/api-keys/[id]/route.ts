import type { NextRequest } from "next/server";

import { getBackendApiUrl } from "@/constants/api";

import { getRequestToken } from "@/lib/get-request-token";

import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function DELETE(
  _req: NextRequest,

  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getRequestToken();

  const { id } = await params;

  return proxyFetch(`${BASE_URL}/api-keys/${id}`, {
    method: "DELETE",

    headers: { Authorization: `Bearer ${token}` },
  });
}
