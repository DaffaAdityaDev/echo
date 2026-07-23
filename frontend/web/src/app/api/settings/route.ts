import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function GET(req: NextRequest) {
  const token = await getRequestToken()
  return proxyFetch(`${BASE_URL}/settings`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

export async function PUT(req: NextRequest) {
  const token = await getRequestToken()
  const body = await req.json()
  return proxyFetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
