import { sign, verify } from 'jsonwebtoken'

const SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET || ''
const JWT_ALGORITHM = 'HS256'
const JWT_EXPIRY = '60s'

export interface ServiceJwtPayload {
  sub: 'agent'
  iat: number
  exp: number
  jti?: string
}

export function signServiceJwt(): string {
  if (!SERVICE_JWT_SECRET) {
    throw new Error('SERVICE_JWT_SECRET is not configured')
  }
  return sign(
    { sub: 'agent' } as ServiceJwtPayload,
    SERVICE_JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRY }
  )
}

export function verifyServiceJwt(token: string): ServiceJwtPayload {
  if (!SERVICE_JWT_SECRET) {
    throw new Error('SERVICE_JWT_SECRET is not configured')
  }
  return verify(token, SERVICE_JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as ServiceJwtPayload
}
