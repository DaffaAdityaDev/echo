import { cookies, headers } from 'next/headers'

export async function getRequestToken(): Promise<string> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get('auth_token')?.value ?? cookieStore.get('token')?.value
  if (fromCookie) return fromCookie

  const headersList = await headers()
  const authHeader = headersList.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return ''
}
