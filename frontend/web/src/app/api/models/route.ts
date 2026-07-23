import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function GET(req: NextRequest) {
  const token = await getRequestToken()
  return proxyFetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
