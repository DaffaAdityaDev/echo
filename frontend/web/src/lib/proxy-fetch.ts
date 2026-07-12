import { NextResponse } from 'next/server'

export async function proxyFetch(url: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const res = await fetch(url, init)

    if (res.status === 204) return new NextResponse(null, { status: 204 })

    const contentType = res.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    const text = await res.text()
    if (!text) {
      return NextResponse.json({ error: 'Empty response from upstream' }, { status: res.status })
    }
    return NextResponse.json({ error: text }, { status: res.status })
  } catch (err: unknown) {
    console.error(`[proxyFetch] Error fetching ${url}:`, err)
    const message = err instanceof Error ? err.message : 'Failed to proxy request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
