import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requirePerm(["accounting", "checkout", "pos"]);
  const { id } = await params;
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
  if (!inv) return fail(404, "الفاتورة مو موجودة");
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, inv.orderId));
  const items = (await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, inv.orderId))).filter((i) => i.status !== "VOID");
  const pays = await db.select().from(schema.payments).where(eq(schema.payments.invoiceId, id));
  const table = o?.tableId ? (await db.select().from(schema.tables).where(eq(schema.tables.id, o.tableId)))[0] : null;
  const cashier = inv.cashierId ? (await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, inv.cashierId)))[0] : null;
  const s = await getSettings();
  // merge identical lines for the printed receipt
  const merged = new Map<string, { name: string; qty: number; unitPrice: number }>();
  for (const i of items) {
    const k = `${i.menuItemId}:${i.unitPrice}`;
    const m = merged.get(k) ?? { name: i.nameAr, qty: 0, unitPrice: i.unitPrice };
    m.qty += i.qty;
    merged.set(k, m);
  }
  return ok({
    invoice: inv, order: o, table: table?.label ?? null, cashier: cashier?.name ?? null, payments: pays, lines: [...merged.values()],
    restaurant: { name: s.restaurantName, phone: s.phone, address: s.addressAr, currency: s.currencyLabel },
  });
});
