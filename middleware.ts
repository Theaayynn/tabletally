import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const encodedSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || "insecure-dev-secret-change-me"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPath = pathname.startsWith("/admin");
  const isExecPath = pathname.startsWith("/executive");
  if (!isAdminPath && !isExecPath) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    const role = payload.role as string;
    if (isAdminPath && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (isExecPath && role !== "EXECUTIVE") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } catch {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/executive/:path*"],
};
