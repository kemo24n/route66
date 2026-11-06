import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function getSettings() {
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (s) return s;
  const [created] = await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(schema.settings).where(eq(schema.settings.id, 1)))[0];
}

export async function audit(userId: string | null, action: string, entity?: string, entityId?: string, data?: unknown) {
  await db.insert(schema.auditLogs).values({ userId, action, entity, entityId, data: data as object });
}
