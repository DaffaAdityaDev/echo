import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function GET(req: NextRequest) {
  const token = await getRequestToken()
  return proxyFetch(`${BASE_URL}/admin/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function POST(req: NextRequest) {
  const token = await getRequestToken()
  const body = await req.json()
  return proxyFetch(`${BASE_URL}/admin/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
