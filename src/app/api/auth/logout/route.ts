import { ok } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
