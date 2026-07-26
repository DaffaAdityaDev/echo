import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function POST(req: NextRequest) {
  const token = await getRequestToken()
  const body = await req.json()

  const upstream = await fetch(`${BASE_URL}/studio/playground`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!upstream.ok) {
    const errorText = await upstream.text()
    return new Response(errorText, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    })
  }

  return new Response(upstream.body ?? new ReadableStream({ start(c) { c.close() } }), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
