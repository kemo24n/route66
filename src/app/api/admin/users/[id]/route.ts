import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };
const Patch = z.object({
  name: z.string().trim().min(1).max(40), role: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER", "WAITER", "KITCHEN"]),
  active: z.boolean(), password: z.string().min(6).max(64),
}).partial();

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("users");
  const { id } = await params;
  const b = Patch.parse(await req.json());
  if (id === s.uid && (b.active === false || (b.role && b.role !== "OWNER"))) return fail(400, "ما فيك توقف حسابك أو تشيل صلاحيتك");
  if (b.active === false || (b.role && b.role !== "OWNER")) {
    const owners = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.role, "OWNER"), eq(schema.users.active, true), ne(schema.users.id, id)));
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (target?.role === "OWNER" && owners.length === 0) return fail(400, "لازم يضل في مالك واحد عالأقل");
  }
  const { password, ...rest } = b;
  await db.update(schema.users).set({ ...rest, ...(password ? { passwordHash: bcrypt.hashSync(password, 10) } : {}) }).where(eq(schema.users.id, id));
  await audit(s.uid, "user.update", "user", id, { ...rest, password: password ? "changed" : undefined });
  return ok({ ok: true });
});
