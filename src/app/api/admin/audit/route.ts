import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePerm(["users", "risk"]);
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return ok({ logs: rows.map((r) => ({ ...r, user: users.find((u) => u.id === r.userId)?.name ?? "النظام" })) });
});
