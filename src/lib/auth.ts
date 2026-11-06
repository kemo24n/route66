import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role, Perm } from "./roles";
import { can } from "./roles";

export const SESSION_COOKIE = "r66_session";
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s || "dev-secret-change-me-please-32-chars-min");
};

export type Session = { uid: string; name: string; role: Role; username: string };

export async function signSession(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14h")
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: String(payload.uid), name: String(payload.name), role: payload.role as Role, username: String(payload.username) };
  } catch {
    return null;
  }
}

export async function getSession() {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** for route handlers: throws 401/403 */
export async function requirePerm(p: Perm | Perm[]) {
  const s = await getSession();
  if (!s) throw new HttpError(401, "سجّل الدخول أولاً");
  const list = Array.isArray(p) ? p : [p];
  if (!list.some((x) => can(s.role, x))) throw new HttpError(403, "ما عندك صلاحية لهالعملية");
  return s;
}

export async function requireUser() {
  const s = await getSession();
  if (!s) throw new HttpError(401, "سجّل الدخول أولاً");
  return s;
}
