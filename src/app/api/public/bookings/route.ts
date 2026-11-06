import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail, clientIp, rateLimit } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { bookableDates, bookingCode, holdingCondition, sweepBookings } from "@/lib/bookings";
import { slotsForDate, addMinutes } from "@/lib/time";
import { assessBooking, isBlocked } from "@/lib/risk";
import { normalizeSyPhone } from "@/lib/risk-core";
import { publish } from "@/lib/events";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(5).max(20),
  partySize: z.number().int().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  tableId: z.string().min(1),
  notes: z.string().trim().max(300).optional(),
  deviceId: z.string().max(80).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  website: z.string().optional(), // honeypot: real people never see this field
});

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  const body = Body.parse(await req.json());
  const s = await getSettings();
  if (!s.bookingEnabled) return fail(400, "الحجز أونلاين موقف حالياً، اتصل فينا");

  // bot trap: answer like it worked, store nothing
  if (body.website && body.website.trim()) return ok({ code: bookingCode(), status: "PENDING" });

  if (!rateLimit(`bk-ip:${ip}`, 8, 60 * 60_000) || (body.deviceId && !rateLimit(`bk-dev:${body.deviceId}`, 5, 60 * 60_000))) {
    return fail(429, "عملت حجوزات كتير بوقت قصير. اتصل فينا إذا بدك تحجز");
  }

  const { phone, valid } = normalizeSyPhone(body.phone);
  if (!valid) return fail(400, "اكتب رقم موبايل سوري صحيح (مثلاً 0944123456)");
  if (body.partySize > s.maxPartySize) return fail(400, `للحجوزات فوق ${s.maxPartySize} أشخاص اتصل فينا مباشرة`);
  if (!bookableDates(s).includes(body.date)) return fail(400, "التاريخ خارج فترة الحجز");
  const slot = slotsForDate(body.date, s.openTime, s.closeTime, s.slotMinutes, s.bookingDurationMin).find((x) => x.time === body.time);
  if (!slot) return fail(400, "هالوقت مو متاح للحجز");
  if (slot.at.getTime() - Date.now() < s.minLeadMinutes * 60000) return fail(400, "الوقت قريب كتير، اختار وقت أبعد أو اتصل فينا");

  const blocked = await isBlocked(phone, ip, body.deviceId);
  if (blocked) return fail(403, "ما فينا نستقبل حجز أونلاين من هالرقم. اتصل فينا على الرقم الموجود بالصفحة");

  const [table] = await db.select().from(schema.tables).where(eq(schema.tables.id, body.tableId));
  if (!table || !table.active || !table.bookable) return fail(400, "الطاولة مو متاحة");
  if (table.seats < body.partySize) return fail(400, "الطاولة صغيرة على عدد الأشخاص");

  await sweepBookings();
  const startAt = slot.at;
  const endAt = addMinutes(startAt, s.bookingDurationMin);
  const risk = await assessBooking({ name: body.name, phoneRaw: body.phone, partySize: body.partySize, startAt, ip, deviceId: body.deviceId, elapsedMs: body.elapsedMs }, s);

  const status = risk.level === "LOW" ? "CONFIRMED" : risk.level === "MEDIUM" ? "PENDING" : "REVIEW";
  const holdUntil = status === "PENDING" ? new Date(Math.min(Date.now() + s.pendingHoldMinutes * 60000, startAt.getTime())) : null;

  const result = await db.transaction(async (tx) => {
    // serialise bookings on the same table so two people can't grab it at once
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${table.id}))`);
    const clash = await tx.select({ id: schema.bookings.id }).from(schema.bookings)
      .where(and(eq(schema.bookings.tableId, table.id), holdingCondition(startAt, endAt))).limit(1);
    if (clash.length) return null;
    const [cust] = await tx.insert(schema.customers).values({ phone, name: body.name })
      .onConflictDoUpdate({ target: schema.customers.phone, set: { name: body.name } }).returning();
    let code = bookingCode();
    for (let i = 0; i < 3; i++) {
      const exists = await tx.select({ id: schema.bookings.id }).from(schema.bookings).where(eq(schema.bookings.code, code));
      if (!exists.length) break;
      code = bookingCode();
    }
    const [bk] = await tx.insert(schema.bookings).values({
      code, customerId: cust.id, name: body.name, phone, partySize: body.partySize, startAt, endAt, tableId: table.id,
      status, notes: body.notes, riskScore: risk.score, riskLevel: risk.level, riskReasons: risk.reasons, features: risk.features,
      ip, deviceId: body.deviceId, holdUntil, confirmedAt: status === "CONFIRMED" ? new Date() : null,
    }).returning();
    return bk;
  });

  if (!result) return fail(409, "انحجزت هالطاولة هلق، اختار طاولة تانية");
  publish("bookings", "created", { id: result.id, status: result.status, risk: result.riskLevel });
  publish("floor", "booking", { id: result.id });
  return ok({ code: result.code, status: result.status });
});
