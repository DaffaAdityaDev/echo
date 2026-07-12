import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken()
  const { id } = await params
  return proxyFetch(`${BASE_URL}/sessions/${id}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
