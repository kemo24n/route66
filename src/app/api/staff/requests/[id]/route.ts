import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { createOrder, openOrderForTable } from "@/lib/orders";
import { bookingToSeat } from "@/lib/bookings";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ action: z.enum(["ack", "done", "reject", "accept"]), sendNow: z.boolean().default(true) });

/**
 * ack    - "on my way"
 * done   - handled
 * reject - fake / not at the table
 * accept - ORDER request: waiter checked the table, items go into the table's order (and to the kitchen)
 */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("requests");
  const { id } = await params;
  const b = Body.parse(await req.json());
  const [r] = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, id));
  if (!r) return fail(404, "الطلب مو موجود");
  if (r.status === "DONE" || r.status === "REJECTED") return fail(400, "الطلب انتهى");

  if (b.action === "accept") {
    if (r.type !== "ORDER") return fail(400, "هاد مو طلب أكل");
    let order = await openOrderForTable(r.tableId);
    if (!order) {
      const bk = await bookingToSeat(r.tableId);
      if (bk) await db.update(schema.bookings).set({ status: "SEATED", seatedAt: new Date(), handledBy: s.uid }).where(eq(schema.bookings.id, bk.id));
      order = await createOrder({ tableId: r.tableId, type: "DINE_IN", guests: 1, waiterId: s.uid, bookingId: bk?.id ?? null });
    }
    const lines = r.payload?.items ?? [];
    const menu = lines.length ? await db.select().from(schema.menuItems).where(inArray(schema.menuItems.id, lines.map((l) => l.menuItemId))) : [];
    const now = new Date();
    for (const l of lines) {
      const m = menu.find((x) => x.id === l.menuItemId);
      if (!m || !m.available) continue;
      await db.insert(schema.orderItems).values({
        orderId: order.id, menuItemId: m.id, nameAr: m.nameAr, unitPrice: m.price, qty: l.qty, notes: l.notes || null, station: m.station,
        fromQr: true, status: b.sendNow ? "NEW" : "DRAFT", sentAt: b.sendNow ? now : null,
      });
    }
    await db.update(schema.serviceRequests).set({ status: "DONE", handledById: s.uid, handledAt: now }).where(eq(schema.serviceRequests.id, id));
    if (b.sendNow) publish("kitchen", "new", { orderId: order.id });
    publish("floor", "order", { id: order.id });
    publish("requests", "changed", { id });
    return ok({ orderId: order.id });
  }

  const status = b.action === "ack" ? "ACK" : b.action === "done" ? "DONE" : "REJECTED";
  await db.update(schema.serviceRequests).set({ status, handledById: s.uid, handledAt: new Date() }).where(eq(schema.serviceRequests.id, id));
  if (b.action === "reject" && r.deviceId) {
    // a device with 3 rejected requests gets blocked from the QR page
    const count = (await db.select({ status: schema.serviceRequests.status }).from(schema.serviceRequests).where(eq(schema.serviceRequests.deviceId, r.deviceId))).filter((x) => x.status === "REJECTED").length;
    if (count >= 3) {
      await db.insert(schema.blockEntries).values({ type: "DEVICE", value: r.deviceId, reason: "طلبات وهمية من QR الطاولة" }).onConflictDoNothing();
    }
  }
  publish("requests", "changed", { id });
  publish("floor", "request", { tableId: r.tableId });
  return ok({ ok: true });
});
