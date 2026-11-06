import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";
import { finishBooking, holdingCondition } from "@/lib/bookings";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  action: z.enum(["confirm", "seat", "complete", "noshow", "cancel", "reject", "fake", "block", "move"]),
  tableId: z.string().optional(),
  reason: z.string().max(200).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("bookings.manage");
  const { id } = await params;
  const b = Body.parse(await req.json());
  const [bk] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
  if (!bk) return fail(404, "الحجز مو موجود");
  const B = schema.bookings;
  const now = new Date();

  switch (b.action) {
    case "confirm": {
      if (!["PENDING", "REVIEW", "EXPIRED"].includes(bk.status)) return fail(400, "الحجز مأكد أو مسكّر");
      if (bk.tableId) {
        const clash = await db.select({ id: B.id }).from(B).where(and(eq(B.tableId, bk.tableId), ne(B.id, bk.id), holdingCondition(bk.startAt, bk.endAt)));
        if (clash.length) return fail(409, "الطاولة صارت محجوزة لحدا تاني، انقل الحجز لطاولة تانية");
      }
      await db.update(B).set({ status: "CONFIRMED", confirmedAt: now, holdUntil: null, handledBy: s.uid }).where(eq(B.id, id));
      break;
    }
    case "move": {
      if (!b.tableId) return fail(400, "اختار طاولة");
      const clash = await db.select({ id: B.id }).from(B).where(and(eq(B.tableId, b.tableId), ne(B.id, bk.id), holdingCondition(bk.startAt, bk.endAt)));
      if (clash.length) return fail(409, "الطاولة محجوزة بهالوقت");
      await db.update(B).set({ tableId: b.tableId, handledBy: s.uid }).where(eq(B.id, id));
      break;
    }
    case "seat":
      await db.update(B).set({ status: "SEATED", seatedAt: now, handledBy: s.uid }).where(eq(B.id, id));
      break;
    case "complete":
      await finishBooking(id, "COMPLETED", s.uid);
      break;
    case "noshow":
      await finishBooking(id, "NO_SHOW", s.uid);
      break;
    case "cancel":
      await finishBooking(id, "CANCELLED", s.uid);
      break;
    case "reject":
      await db.update(B).set({ status: "REJECTED", closedAt: now, handledBy: s.uid, notes: [bk.notes, b.reason].filter(Boolean).join(" | ") || null }).where(eq(B.id, id));
      break;
    case "fake":
    case "block": {
      // staff-confirmed fake: used as a training example, and optionally blocks the phone/device
      await db.update(B).set({ status: "REJECTED", closedAt: now, handledBy: s.uid, notes: [bk.notes, "[fake]", b.reason].filter(Boolean).join(" ") }).where(eq(B.id, id));
      if (b.action === "block") {
        await db.update(schema.customers).set({ blocked: true, blockReason: b.reason || "حجز وهمي" }).where(eq(schema.customers.id, bk.customerId));
        await db.insert(schema.blockEntries).values({ type: "PHONE", value: bk.phone, reason: b.reason || "حجز وهمي" }).onConflictDoNothing();
        if (bk.deviceId) await db.insert(schema.blockEntries).values({ type: "DEVICE", value: bk.deviceId, reason: "حجز وهمي" }).onConflictDoNothing();
      }
      break;
    }
  }
  await audit(s.uid, `booking.${b.action}`, "booking", id, b.reason ? { reason: b.reason } : undefined);
  publish("bookings", "updated", { id });
  publish("floor", "booking", { id });
  return ok({ ok: true });
});
