import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { loadOrder } from "@/lib/orders";
import { getSettings, audit } from "@/lib/settings";
import { computeTotals } from "@/lib/money";
import { finishBooking } from "@/lib/bookings";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  discount: z.number().int().min(0).default(0),
  payments: z.array(z.object({
    method: z.enum(["CASH_SYP", "CASH_USD", "SHAM_CASH", "CARD"]),
    amount: z.number().positive(), // in the payment's own currency (USD for CASH_USD)
    reference: z.string().max(80).optional(),
  })).min(1).max(5),
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("checkout");
  const { id } = await params;
  const b = Body.parse(await req.json());
  const o = await loadOrder(id);
  if (!o) return fail(404, "الطلب مو موجود");
  if (o.status !== "OPEN") return fail(400, "الطلب مدفوع أو ملغى");
  if (o.items.some((i) => i.status === "DRAFT")) return fail(400, "في أصناف لسا ما انبعتت للمطبخ. ابعتها أو احذفها قبل الدفع");
  const billable = o.items.filter((i) => i.status !== "VOID");
  if (!billable.length) return fail(400, "الطلب فاضي");

  const st = await getSettings();
  const totals = computeTotals(o.subtotal, b.discount, st.servicePercent, st.taxPercent);
  const paid = b.payments.map((p) => ({ ...p, syp: Math.round(p.method === "CASH_USD" ? p.amount * st.usdRate : p.amount) }));
  const sum = paid.reduce((a, p) => a + p.syp, 0);
  if (sum < totals.total) return fail(400, `المبلغ ناقص ${(totals.total - sum).toLocaleString("en-US")} ${st.currencyLabel}`);
  const nonCash = paid.filter((p) => p.method === "SHAM_CASH" || p.method === "CARD").reduce((a, p) => a + p.syp, 0);
  if (nonCash > totals.total) return fail(400, "الدفع الإلكتروني أكبر من الفاتورة، ما في باقي على شام كاش أو البطاقة");
  const change = sum - totals.total;

  const result = await db.transaction(async (tx) => {
    // the cashier's open shift; opens one automatically if there isn't
    let [shift] = await tx.select().from(schema.shifts).where(and(eq(schema.shifts.userId, s.uid), isNull(schema.shifts.closedAt)));
    if (!shift) [shift] = await tx.insert(schema.shifts).values({ userId: s.uid, openingCash: 0, notes: "انفتحت تلقائياً مع أول فاتورة" }).returning();

    const [locked] = await tx.update(schema.orders).set({ status: "PAID", closedAt: new Date(), discount: totals.discount })
      .where(and(eq(schema.orders.id, id), eq(schema.orders.status, "OPEN"))).returning();
    if (!locked) return null;
    const [inv] = await tx.insert(schema.invoices).values({
      orderId: id, subtotal: totals.subtotal, discount: totals.discount, serviceCharge: totals.serviceCharge, tax: totals.tax, total: totals.total,
      taxPercent: st.taxPercent, servicePercent: st.servicePercent, usdRate: st.usdRate, cashierId: s.uid, shiftId: shift.id,
    }).returning();
    // change is handed back in lira cash: take it off the lira lines first, then dollars,
    // so the lira drawer count at the end of the shift stays right
    let changeLeft = change;
    const net = paid.map((p) => ({ ...p, net: p.syp }));
    for (const m of ["CASH_SYP", "CASH_USD"] as const) {
      for (const p of net) {
        if (changeLeft <= 0 || p.method !== m) continue;
        const take = Math.min(changeLeft, p.net);
        p.net -= take;
        changeLeft -= take;
      }
    }
    for (const p of net) {
      await tx.insert(schema.payments).values({ invoiceId: inv.id, method: p.method, amount: p.net, originalAmount: p.amount, currency: p.method === "CASH_USD" ? "USD" : "SYP", reference: p.reference });
    }
    await tx.update(schema.orderItems).set({ status: "SERVED" }).where(and(eq(schema.orderItems.orderId, id), inArray(schema.orderItems.status, ["READY"])));
    if (o.tableId) {
      await tx.update(schema.serviceRequests).set({ status: "DONE", handledById: s.uid, handledAt: new Date() })
        .where(and(eq(schema.serviceRequests.tableId, o.tableId), inArray(schema.serviceRequests.status, ["OPEN", "ACK"]), inArray(schema.serviceRequests.type, ["BILL", "CALL_WAITER"])));
    }
    return inv;
  });
  if (!result) return fail(409, "الطلب اندفع من جهاز تاني");
  if (o.bookingId) await finishBooking(o.bookingId, "COMPLETED", s.uid);
  if (totals.discount > 0) await audit(s.uid, "invoice.discount", "invoice", result.id, { discount: totals.discount });
  publish("floor", "paid", { id });
  publish("requests", "changed", {});
  publish("kitchen", "changed", {});
  return ok({ invoiceId: result.id, number: result.number, total: totals.total, change });
});
