import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail, clientIp, rateLimit } from "@/lib/http";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { HOME_FOR } from "@/lib/roles";
import { audit } from "@/lib/settings";

const Body = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 10, 10 * 60_000)) return fail(429, "محاولات كتيرة، استنى شوي وجرّب");
  const { username, password } = Body.parse(await req.json());
  const [u] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (!u || !u.active || !bcrypt.compareSync(password, u.passwordHash)) return fail(401, "اسم المستخدم أو كلمة السر غلط");
  const token = await signSession({ uid: u.id, name: u.name, role: u.role, username: u.username });
  await audit(u.id, "login");
  const res = ok({ ok: true, home: HOME_FOR[u.role], user: { name: u.name, role: u.role } });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "1", path: "/", maxAge: 14 * 3600 });
  return res;
});
