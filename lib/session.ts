import { cookies } from "next/headers";
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from "./auth";

/** Reads and verifies the session cookie. Returns null if missing/invalid/expired. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
