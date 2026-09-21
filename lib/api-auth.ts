import { NextResponse } from "next/server";
import { getSession } from "./session";
import { SessionPayload } from "./auth";

type Guard =
  | { session: SessionPayload; error: null }
  | { session: null; error: NextResponse };

/** Any authenticated user (admin or executive). */
export async function requireUser(): Promise<Guard> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/** Admin-only routes. */
export async function requireAdmin(): Promise<Guard> {
  const result = await requireUser();
  if (result.error) return result;
  if (result.session.role !== "ADMIN") {
    return {
      session: null,
      error: NextResponse.json(
        { error: "This action requires an admin account." },
        { status: 403 }
      ),
    };
  }
  return result;
}

/**
 * Resolves the outlet a request is allowed to act on.
 * - Executives are ALWAYS pinned to their own assigned outlet, no matter what
 *   outletId the client sent — this is the server-side enforcement that stops
 *   an executive from writing another outlet's data by editing the request.
 * - Admins may target any outlet (or `null` to mean "all outlets", where the
 *   caller supports it).
 */
export function resolveOutletScope(
  session: SessionPayload,
  requestedOutletId: string | null
): { outletId: string | null; error: NextResponse | null } {
  if (session.role === "EXECUTIVE") {
    if (!session.outletId) {
      return {
        outletId: null,
        error: NextResponse.json(
          { error: "Your account has no outlet assigned. Contact an admin." },
          { status: 403 }
        ),
      };
    }
    return { outletId: session.outletId, error: null };
  }
  return { outletId: requestedOutletId, error: null };
}
