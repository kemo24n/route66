import { db, schema } from "@/db";
import { and, eq, gt, inArray, lt, or, sql, isNull, asc } from "drizzle-orm";
import { addMinutes, fromLocal, slotsForDate, localDateStr, addDays } from "./time";
import type { Setting } from "@/db/schema";
import { publish } from "./events";

const B = schema.bookings;

/** PENDING bookings past their hold time give the table back */
export async function sweepBookings() {
  const now = new Date();
  const expired = await db.update(B).set({ status: "EXPIRED", closedAt: now })
    .where(and(eq(B.status, "PENDING"), lt(B.holdUntil, now))).returning({ id: B.id });
  // REVIEW bookings whose time already passed are closed too
  await db.update(B).set({ status: "EXPIRED", closedAt: now })
    .where(and(eq(B.status, "REVIEW"), lt(B.startAt, now)));
  if (expired.length) publish("bookings", "expired", { count: expired.length });
}

/** bookings that hold a table in a time window */
export function holdingCondition(start: Date, end: Date) {
  const now = new Date();
  return and(
    sql`${B.startAt} < ${end} and ${B.endAt} > ${start}`,
    or(inArray(B.status, ["CONFIRMED", "SEATED"]), and(eq(B.status, "PENDING"), gt(B.holdUntil, now))),
  );
}

export type TableAvailability = {
  id: string; label: string; seats: number; zoneId: string; shape: "ROUND" | "RECT";
  x: number; y: number; w: number; h: number; rotation: number;
  state: "free" | "busy" | "small" | "closed";
  fit: boolean;
};

export async function availability(date: string, time: string, party: number, s: Setting) {
  await sweepBookings();
  const start = fromLocal(date, time);
  // the "date" is the evening the guest picked; times after midnight belong to the next calendar day
  const slot = slotsForDate(date, s.openTime, s.closeTime, s.slotMinutes, s.bookingDurationMin).find((x) => x.time === time);
  const startAt = slot?.at ?? start;
  const endAt = addMinutes(startAt, s.bookingDurationMin);
  const zones = await db.select().from(schema.zones).orderBy(asc(schema.zones.sort));
  const tbls = await db.select().from(schema.tables).where(eq(schema.tables.active, true));
  const busy = await db.select({ tableId: B.tableId }).from(B).where(holdingCondition(startAt, endAt));
  const busySet = new Set(busy.map((b) => b.tableId));

  // tables with a running order are busy for the next 90 minutes
  if (startAt.getTime() - Date.now() < 90 * 60000) {
    const open = await db.select({ tableId: schema.orders.tableId }).from(schema.orders).where(eq(schema.orders.status, "OPEN"));
    open.forEach((o) => o.tableId && busySet.add(o.tableId));
  }

  const candidates = tbls.filter((t) => t.bookable && t.seats >= party && !busySet.has(t.id));
  const bestSeats = candidates.length ? Math.min(...candidates.map((t) => t.seats)) : 0;

  const result: TableAvailability[] = tbls.map((t) => ({
    id: t.id, label: t.label, seats: t.seats, zoneId: t.zoneId, shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation,
    state: !t.bookable ? "closed" : busySet.has(t.id) ? "busy" : t.seats < party ? "small" : "free",
    fit: t.bookable && !busySet.has(t.id) && t.seats >= party && t.seats === bestSeats,
  }));
  return { zones, tables: result, startAt, endAt };
}

/** slots for the date with whether at least one table fits the party */
export async function slotsWithAvailability(date: string, party: number, s: Setting) {
  await sweepBookings();
  const now = new Date();
  const slots = slotsForDate(date, s.openTime, s.closeTime, s.slotMinutes, s.bookingDurationMin);
  const first = slots[0]?.at;
  const last = slots[slots.length - 1]?.at;
  if (!first || !last) return [];
  const rangeEnd = addMinutes(last, s.bookingDurationMin);
  const tbls = await db.select().from(schema.tables).where(and(eq(schema.tables.active, true), eq(schema.tables.bookable, true)));
  const fitting = tbls.filter((t) => t.seats >= party);
  const bks = await db.select({ tableId: B.tableId, startAt: B.startAt, endAt: B.endAt }).from(B).where(holdingCondition(first, rangeEnd));
  return slots.map((sl) => {
    const end = addMinutes(sl.at, s.bookingDurationMin);
    const tooSoon = sl.at.getTime() - now.getTime() < s.minLeadMinutes * 60000;
    const freeCount = fitting.filter((t) => !bks.some((b) => b.tableId === t.id && b.startAt < end && b.endAt > sl.at)).length;
    return { time: sl.time, available: !tooSoon && freeCount > 0, freeTables: tooSoon ? 0 : freeCount, fill: fitting.length ? Math.round((1 - freeCount / fitting.length) * 100) : 100 };
  });
}

/** times on a date when one specific table is free (for "busy table" alternatives) */
export async function tableFreeTimes(date: string, tableId: string, s: Setting) {
  await sweepBookings();
  const now = new Date();
  const slots = slotsForDate(date, s.openTime, s.closeTime, s.slotMinutes, s.bookingDurationMin);
  if (!slots.length) return [];
  const bks = await db.select({ startAt: B.startAt, endAt: B.endAt }).from(B)
    .where(and(eq(B.tableId, tableId), holdingCondition(slots[0].at, addMinutes(slots[slots.length - 1].at, s.bookingDurationMin))));
  return slots.filter((sl) => {
    const end = addMinutes(sl.at, s.bookingDurationMin);
    return sl.at.getTime() - now.getTime() >= s.minLeadMinutes * 60000 && !bks.some((b) => b.startAt < end && b.endAt > sl.at);
  }).map((sl) => sl.time);
}

export function bookableDates(s: Setting) {
  const today = localDateStr(new Date());
  return Array.from({ length: s.maxDaysAhead + 1 }, (_, i) => addDays(today, i));
}

export function bookingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) c += alphabet[b % alphabet.length];
  return `R66-${c}`;
}

/** close out a booking and update the customer's record (used for model training) */
export async function finishBooking(id: string, status: "COMPLETED" | "NO_SHOW" | "CANCELLED", userId?: string) {
  const [bk] = await db.select().from(B).where(eq(B.id, id));
  if (!bk) return null;
  const was = bk.status;
  const [up] = await db.update(B).set({ status, closedAt: new Date(), handledBy: userId ?? bk.handledBy }).where(eq(B.id, id)).returning();
  const C = schema.customers;
  if (status === "COMPLETED" && was !== "COMPLETED") await db.update(C).set({ completed: sql`${C.completed} + 1` }).where(eq(C.id, bk.customerId));
  if (status === "NO_SHOW" && was !== "NO_SHOW") await db.update(C).set({ noShows: sql`${C.noShows} + 1` }).where(eq(C.id, bk.customerId));
  if (status === "CANCELLED" && was !== "CANCELLED") await db.update(C).set({ cancellations: sql`${C.cancellations} + 1` }).where(eq(C.id, bk.customerId));
  publish("bookings", "updated", { id });
  publish("floor", "booking", { id });
  return up;
}

/** booking on this table that should be seated now (started up to 30 min ago or starting in the next 45 min) */
export async function bookingToSeat(tableId: string) {
  const now = new Date();
  const [bk] = await db.select().from(B).where(and(
    eq(B.tableId, tableId), inArray(B.status, ["CONFIRMED", "PENDING"]),
    lt(B.startAt, addMinutes(now, 45)), gt(B.startAt, addMinutes(now, -60)),
  )).orderBy(asc(B.startAt)).limit(1);
  return bk ?? null;
}

export { isNull };
