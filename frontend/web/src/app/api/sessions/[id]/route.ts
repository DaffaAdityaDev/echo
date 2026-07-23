import { NextRequest } from 'next/server'
import { getRequestToken } from '@/lib/get-request-token'
import { proxyFetch } from '@/lib/proxy-fetch'
import { getBackendApiUrl } from '@/constants/api'

const BASE_URL = getBackendApiUrl()

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken()
  const { id } = await params
  return proxyFetch(`${BASE_URL}/sessions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken()
  const { id } = await params
  const body = await req.json()
  return proxyFetch(`${BASE_URL}/sessions/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRequestToken()
  const { id } = await params
  return proxyFetch(`${BASE_URL}/sessions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
