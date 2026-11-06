import { z } from "zod";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { businessDay, businessDayRange, addDays, localParts } from "@/lib/time";

export const dynamic = "force-dynamic";
const Q = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** sales report for a range of business days (inclusive) */
export const GET = handle(async (req: Request) => {
  await requirePerm(["accounting"]);
  const q = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const to = q.to ?? businessDay();
  const from = q.from ?? to;
  const start = businessDayRange(from).start;
  const end = businessDayRange(to).end;

  const invs = await db.select().from(schema.invoices).where(and(gte(schema.invoices.createdAt, start), lt(schema.invoices.createdAt, end)));
  const ids = invs.map((i) => i.id);
  const pays = ids.length ? await db.select().from(schema.payments).where(inArray(schema.payments.invoiceId, ids)) : [];
  const orderIds = invs.map((i) => i.orderId);
  const lines = orderIds.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orderIds)) : [];
  const menu = await db.select({ id: schema.menuItems.id, categoryId: schema.menuItems.categoryId }).from(schema.menuItems);
  const cats = await db.select().from(schema.categories);
  const exps = await db.select().from(schema.expenses).where(and(gte(schema.expenses.createdAt, start), lt(schema.expenses.createdAt, end)));
  const voids = await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.status, "VOID"), gte(schema.orderItems.createdAt, start), lt(schema.orderItems.createdAt, end)));
  const ords = orderIds.length ? await db.select().from(schema.orders).where(inArray(schema.orders.id, orderIds)) : [];

  const sold = lines.filter((l) => l.status !== "VOID");
  const byItem = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const l of sold) {
    const x = byItem.get(l.menuItemId) ?? { name: l.nameAr, qty: 0, revenue: 0 };
    x.qty += l.qty;
    x.revenue += l.qty * l.unitPrice;
    byItem.set(l.menuItemId, x);
  }
  const byCat = new Map<string, number>();
  for (const l of sold) {
    const c = menu.find((m) => m.id === l.menuItemId)?.categoryId;
    const name = cats.find((x) => x.id === c)?.nameAr ?? "أخرى";
    byCat.set(name, (byCat.get(name) ?? 0) + l.qty * l.unitPrice);
  }
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
  for (const i of invs) byHour[localParts(i.createdAt).h].total += i.total;
  const days: { day: string; total: number; count: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = businessDayRange(d);
    const di = invs.filter((i) => i.createdAt >= r.start && i.createdAt < r.end);
    days.push({ day: d, total: di.reduce((a, i) => a + i.total, 0), count: di.length });
    if (days.length > 400) break;
  }
  const method = (m: string) => pays.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
  const gross = invs.reduce((a, i) => a + i.subtotal, 0);
  const total = invs.reduce((a, i) => a + i.total, 0);
  const expenses = exps.reduce((a, e) => a + e.amount, 0);

  return ok({
    from, to,
    summary: {
      invoices: invs.length, gross, discount: invs.reduce((a, i) => a + i.discount, 0), service: invs.reduce((a, i) => a + i.serviceCharge, 0),
      tax: invs.reduce((a, i) => a + i.tax, 0), total, avgTicket: invs.length ? Math.round(total / invs.length) : 0,
      guests: ords.reduce((a, o) => a + o.guests, 0), takeaway: ords.filter((o) => o.type === "TAKEAWAY").length,
      expenses, net: total - expenses, voids: voids.length, voidValue: voids.reduce((a, v) => a + v.qty * v.unitPrice, 0),
    },
    payments: { CASH_SYP: method("CASH_SYP"), CASH_USD: method("CASH_USD"), SHAM_CASH: method("SHAM_CASH"), CARD: method("CARD") },
    topItems: [...byItem.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 12),
    byCategory: [...byCat.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    byHour: byHour.filter((h) => h.total > 0),
    days,
    expenses: exps.slice(0, 100),
  });
});
