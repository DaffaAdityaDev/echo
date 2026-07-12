import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

export async function POST(req: NextRequest) {
  const token = await getRequestToken()
  return proxyFetch(`${BASE_URL}/chat/clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
