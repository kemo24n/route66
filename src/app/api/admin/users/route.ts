import { z } from "zod";
import bcrypt from "bcryptjs";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePerm("users");
  const rows = await db.select({ id: schema.users.id, name: schema.users.name, username: schema.users.username, role: schema.users.role, active: schema.users.active, createdAt: schema.users.createdAt }).from(schema.users).orderBy(asc(schema.users.createdAt));
  return ok({ users: rows });
});

const Body = z.object({
  name: z.string().trim().min(1).max(40), username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,20}$/, "اسم المستخدم أحرف إنكليزية وأرقام"),
  password: z.string().min(6).max(64), role: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER", "WAITER", "KITCHEN"]),
});

export const POST = handle(async (req: Request) => {
  const s = await requirePerm("users");
  const b = Body.parse(await req.json());
  try {
    const [u] = await db.insert(schema.users).values({ name: b.name, username: b.username, role: b.role, passwordHash: bcrypt.hashSync(b.password, 10) }).returning({ id: schema.users.id });
    await audit(s.uid, "user.create", "user", u.id, { username: b.username, role: b.role });
    return ok(u);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return fail(409, "اسم المستخدم مستخدم قبل");
    throw e;
  }
});
