import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function POST(req: NextRequest) {
  const token = await getRequestToken()
  const body = await req.json()

  const upstream = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
