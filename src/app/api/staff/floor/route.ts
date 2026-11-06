import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { sweepBookings } from "@/lib/bookings";
import { addMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";

/** live floor: each table with its open order, upcoming booking and waiting requests */
export const GET = handle(async () => {
  await requirePerm(["floor", "requests"]);
  await sweepBookings();
  const now = new Date();
  const zones = await db.select().from(schema.zones).orderBy(asc(schema.zones.sort));
  const tbls = await db.select().from(schema.tables).where(eq(schema.tables.active, true));
  const open = await db.select().from(schema.orders).where(eq(schema.orders.status, "OPEN"));
  const items = open.length
    ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, open.map((o) => o.id)))
    : [];
  const bks = await db.select().from(schema.bookings).where(and(
    inArray(schema.bookings.status, ["CONFIRMED", "PENDING", "SEATED", "REVIEW"]),
    gte(schema.bookings.endAt, now), lt(schema.bookings.startAt, addMinutes(now, 12 * 60)),
  )).orderBy(asc(schema.bookings.startAt));
  const reqs = await db.select().from(schema.serviceRequests).where(inArray(schema.serviceRequests.status, ["OPEN", "ACK"])).orderBy(asc(schema.serviceRequests.createdAt));
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const uname = (id?: string | null) => users.find((u) => u.id === id)?.name ?? null;

  const takeaway = open.filter((o) => !o.tableId).map((o) => {
    const its = items.filter((i) => i.orderId === o.id && i.status !== "VOID");
    return { id: o.id, number: o.number, total: its.reduce((a, i) => a + i.qty * i.unitPrice, 0), createdAt: o.createdAt };
  });

  return ok({
    now,
    zones,
    takeaway,
    tables: tbls.map((t) => {
      const o = open.find((x) => x.tableId === t.id);
      const its = o ? items.filter((i) => i.orderId === o.id && i.status !== "VOID") : [];
      const upcoming = bks.filter((b) => b.tableId === t.id && b.status !== "REVIEW");
      const next = upcoming[0];
      const r = reqs.filter((x) => x.tableId === t.id);
      return {
        id: t.id, label: t.label, seats: t.seats, shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation, zoneId: t.zoneId,
        order: o ? {
          id: o.id, number: o.number, guests: o.guests, createdAt: o.createdAt, waiter: uname(o.waiterId),
          total: its.reduce((a, i) => a + i.qty * i.unitPrice, 0),
          draft: its.filter((i) => i.status === "DRAFT").length,
          cooking: its.filter((i) => i.status === "NEW" || i.status === "PREPARING").length,
          ready: its.filter((i) => i.status === "READY").length,
        } : null,
        booking: next ? { id: next.id, name: next.name, partySize: next.partySize, startAt: next.startAt, status: next.status, riskLevel: next.riskLevel, code: next.code } : null,
        requests: r.map((x) => ({ id: x.id, type: x.type, status: x.status, createdAt: x.createdAt })),
      };
    }),
  });
});
