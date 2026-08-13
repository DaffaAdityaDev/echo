import { sign, verify } from "jsonwebtoken";
import { ENV } from "../../config/env";
import { SERVICE_JWT_ALGORITHM } from "../../config/env.constants";

const SERVICE_JWT_SECRET = ENV.SERVICE_JWT_SECRET;
const JWT_ALGORITHM = SERVICE_JWT_ALGORITHM;
const JWT_EXPIRY = "60s";

export interface ServiceJwtPayload {
  sub: "agent";
  iat: number;
  exp: number;
  jti?: string;
}

export function signServiceJwt(): string {
  return sign({ sub: "agent" } as ServiceJwtPayload, SERVICE_JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRY,
  });
}

export function verifyServiceJwt(token: string): ServiceJwtPayload {
  return verify(token, SERVICE_JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as ServiceJwtPayload;
}
