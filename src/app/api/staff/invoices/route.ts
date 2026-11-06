import { and, desc, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { businessDay, businessDayRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requirePerm(["accounting", "checkout"]);
  const day = new URL(req.url).searchParams.get("day") || businessDay();
  const { start, end } = businessDayRange(day);
  const invs = await db.select().from(schema.invoices).where(and(gte(schema.invoices.createdAt, start), lt(schema.invoices.createdAt, end))).orderBy(desc(schema.invoices.createdAt));
  const pays = invs.length ? await db.select().from(schema.payments).where(inArray(schema.payments.invoiceId, invs.map((i) => i.id))) : [];
  const ords = invs.length ? await db.select().from(schema.orders).where(inArray(schema.orders.id, invs.map((i) => i.orderId))) : [];
  const tbls = await db.select({ id: schema.tables.id, label: schema.tables.label }).from(schema.tables);
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return ok({
    day,
    invoices: invs.map((i) => {
      const o = ords.find((x) => x.id === i.orderId);
      return {
        ...i, orderNumber: o?.number, type: o?.type, table: tbls.find((t) => t.id === o?.tableId)?.label ?? null,
        cashier: users.find((u) => u.id === i.cashierId)?.name, methods: [...new Set(pays.filter((p) => p.invoiceId === i.id).map((p) => p.method))],
      };
    }),
  });
});
