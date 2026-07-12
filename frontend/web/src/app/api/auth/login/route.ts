import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  const response = NextResponse.json(data, { status: res.status })

  if (res.ok && data.token) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    }
    response.cookies.set('auth_token', data.token, cookieOptions)
    response.cookies.set('token', data.token, cookieOptions)
  }

  return response
}
