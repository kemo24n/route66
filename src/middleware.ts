import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-please-32-chars-min");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/staff") && pathname !== "/staff/login") {
    const t = req.cookies.get("r66_session")?.value;
    let okUser = false;
    if (t) {
      try { await jwtVerify(t, secret()); okUser = true; } catch { okUser = false; }
    }
    if (!okUser) {
      const url = req.nextUrl.clone();
      url.pathname = "/staff/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/staff/:path*"] };
