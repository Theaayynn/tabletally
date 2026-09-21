import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const encodedSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || "insecure-dev-secret-change-me"
);

export interface SessionPayload {
  sub: string;
  role: "ADMIN" | "EXECUTIVE";
  outletId: string | null;
  name: string;
  email: string;
  [key: string]: unknown;
}

const SESSION_TTL = "12h";
export const SESSION_COOKIE = "session";

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(encodedSecret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
