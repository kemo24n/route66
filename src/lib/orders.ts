import { db, schema } from "@/db";
import { and, eq, max, ne, asc } from "drizzle-orm";
import { businessDay } from "./time";

const O = schema.orders;
const OI = schema.orderItems;

export async function nextOrderNumber(day: string) {
  const [{ m }] = await db.select({ m: max(O.number) }).from(O).where(eq(O.day, day));
  return (m ?? 0) + 1;
}

/** create an order with a per-day running number; retries on the rare race */
export async function createOrder(values: Omit<typeof O.$inferInsert, "number" | "day">) {
  const day = businessDay();
  for (let i = 0; i < 5; i++) {
    try {
      const number = await nextOrderNumber(day);
      const [o] = await db.insert(O).values({ ...values, day, number }).returning();
      return o;
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  throw new Error("could not allocate order number");
}

export async function loadOrder(id: string) {
  const [o] = await db.select().from(O).where(eq(O.id, id));
  if (!o) return null;
  const items = await db.select().from(OI).where(eq(OI.orderId, id)).orderBy(asc(OI.createdAt));
  const table = o.tableId ? (await db.select().from(schema.tables).where(eq(schema.tables.id, o.tableId)))[0] : null;
  const waiter = o.waiterId ? (await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.id, o.waiterId)))[0] : null;
  const subtotal = items.filter((i) => i.status !== "VOID").reduce((a, i) => a + i.unitPrice * i.qty, 0);
  return { ...o, items, table, waiter, subtotal };
}

export async function openOrderForTable(tableId: string) {
  const [o] = await db.select().from(O).where(and(eq(O.tableId, tableId), eq(O.status, "OPEN")));
  return o ?? null;
}

export function billableItems<T extends { status: string }>(items: T[]) {
  return items.filter((i) => i.status !== "VOID");
}

export { ne };
