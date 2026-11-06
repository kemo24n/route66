import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { createOrder, openOrderForTable } from "@/lib/orders";
import { bookingToSeat } from "@/lib/bookings";
import { publish } from "@/lib/events";
import { businessDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const Body = z.object({ tableId: z.string().optional(), type: z.enum(["DINE_IN", "TAKEAWAY"]).default("DINE_IN"), guests: z.number().int().min(1).max(40).default(2) });

/** open (or reuse) an order for a table, or start a takeaway order */
export const POST = handle(async (req: Request) => {
  const s = await requirePerm("pos");
  const b = Body.parse(await req.json());
  if (b.type === "DINE_IN") {
    if (!b.tableId) return fail(400, "اختار طاولة");
    const existing = await openOrderForTable(b.tableId);
    if (existing) return ok({ id: existing.id, existing: true });
  }
  let bookingId: string | null = null;
  if (b.tableId) {
    const bk = await bookingToSeat(b.tableId);
    if (bk) {
      bookingId = bk.id;
      await db.update(schema.bookings).set({ status: "SEATED", seatedAt: new Date(), handledBy: s.uid }).where(eq(schema.bookings.id, bk.id));
      publish("bookings", "updated", { id: bk.id });
    }
  }
  const o = await createOrder({ tableId: b.type === "DINE_IN" ? b.tableId : null, type: b.type, guests: b.guests, waiterId: s.uid, bookingId });
  publish("floor", "order", { id: o.id });
  return ok({ id: o.id, number: o.number, seatedBooking: bookingId });
});

/** today's orders (for the cashier list) */
export const GET = handle(async (req: Request) => {
  await requirePerm(["pos", "accounting"]);
  const url = new URL(req.url);
  const day = url.searchParams.get("day") || businessDay();
  const status = url.searchParams.get("status");
  const where = status ? and(eq(schema.orders.day, day), inArray(schema.orders.status, status.split(",") as ("OPEN" | "PAID" | "CANCELLED")[])) : eq(schema.orders.day, day);
  const rows = await db.select().from(schema.orders).where(where).orderBy(desc(schema.orders.createdAt));
  return ok({ orders: rows });
});
