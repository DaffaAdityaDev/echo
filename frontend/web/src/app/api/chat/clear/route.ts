import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function POST(req: NextRequest) {
  const token = await getRequestToken()
  return proxyFetch(`${BASE_URL}/chat/clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
