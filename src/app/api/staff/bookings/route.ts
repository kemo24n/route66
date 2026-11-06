import { z } from "zod";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { getSettings, audit } from "@/lib/settings";
import { bookingCode, holdingCondition, sweepBookings } from "@/lib/bookings";
import { fromLocal, addMinutes, addDays, localDateStr } from "@/lib/time";
import { assessBooking } from "@/lib/risk";
import { normalizeSyPhone } from "@/lib/risk-core";
import { publish } from "@/lib/events";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requirePerm("bookings");
  await sweepBookings();
  const date = new URL(req.url).searchParams.get("date") || localDateStr(new Date());
  // a booking "day" runs 05:00 → 05:00 next day so late-night bookings stay with their evening
  const start = fromLocal(date, "05:00");
  const end = fromLocal(addDays(date, 1), "05:00");
  const rows = await db.select().from(schema.bookings).where(and(gte(schema.bookings.startAt, start), lt(schema.bookings.startAt, end))).orderBy(asc(schema.bookings.startAt));
  const tbls = await db.select({ id: schema.tables.id, label: schema.tables.label, seats: schema.tables.seats }).from(schema.tables);
  const custIds = [...new Set(rows.map((r) => r.customerId))];
  const custs = custIds.length ? await db.select().from(schema.customers).where(inArray(schema.customers.id, custIds)) : [];
  const pendingCount = await db.select({ n: sql<number>`count(*)` }).from(schema.bookings).where(sql`${schema.bookings.status} in ('PENDING','REVIEW') and ${schema.bookings.startAt} > now()`);
  return ok({
    date,
    waiting: Number(pendingCount[0].n),
    bookings: rows.map((b) => {
      const c = custs.find((x) => x.id === b.customerId);
      return { ...b, table: tbls.find((t) => t.id === b.tableId) ?? null, customer: c ? { completed: c.completed, noShows: c.noShows, cancellations: c.cancellations, blocked: c.blocked } : null };
    }),
  });
});

const Body = z.object({
  name: z.string().trim().min(1).max(60), phone: z.string().trim().min(5).max(20), partySize: z.number().int().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), tableId: z.string().nullable().optional(),
  notes: z.string().max(300).optional(), source: z.enum(["PHONE", "WALKIN"]).default("PHONE"),
});

/** booking taken by staff (phone call / walk-in). Risk is still scored so history stays useful, but it's confirmed. */
export const POST = handle(async (req: Request) => {
  const s = await requirePerm("bookings.manage");
  const b = Body.parse(await req.json());
  const st = await getSettings();
  const { phone } = normalizeSyPhone(b.phone);
  // times after midnight belong to the evening of `date`
  const [h] = b.time.split(":").map(Number);
  const startAt = fromLocal(h < 5 ? addDays(b.date, 1) : b.date, b.time);
  const endAt = addMinutes(startAt, st.bookingDurationMin);
  if (b.tableId) {
    const clash = await db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.tableId, b.tableId), holdingCondition(startAt, endAt)));
    if (clash.length) return fail(409, "الطاولة محجوزة بهالوقت");
  }
  const risk = await assessBooking({ name: b.name, phoneRaw: b.phone, partySize: b.partySize, startAt }, st);
  const [cust] = await db.insert(schema.customers).values({ phone, name: b.name }).onConflictDoUpdate({ target: schema.customers.phone, set: { name: b.name } }).returning();
  const [bk] = await db.insert(schema.bookings).values({
    code: bookingCode(), customerId: cust.id, name: b.name, phone, partySize: b.partySize, startAt, endAt, tableId: b.tableId ?? null,
    status: "CONFIRMED", source: b.source, notes: b.notes, riskScore: risk.score, riskLevel: risk.level, riskReasons: risk.reasons,
    features: risk.features, confirmedAt: new Date(), handledBy: s.uid,
  }).returning();
  await audit(s.uid, "booking.create", "booking", bk.id);
  publish("bookings", "created", { id: bk.id });
  publish("floor", "booking", { id: bk.id });
  return ok({ id: bk.id, code: bk.code, risk: { score: risk.score, level: risk.level, reasons: risk.reasons } });
});
