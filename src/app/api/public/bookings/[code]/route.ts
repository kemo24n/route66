import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { finishBooking, sweepBookings } from "@/lib/bookings";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ code: string }> };

async function find(code: string) {
  await sweepBookings();
  const [bk] = await db.select().from(schema.bookings).where(eq(schema.bookings.code, code.toUpperCase()));
  return bk;
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { code } = await params;
  const bk = await find(code);
  if (!bk) return fail(404, "ما لقينا حجز بهالرمز");
  const s = await getSettings();
  const table = bk.tableId ? (await db.select().from(schema.tables).where(eq(schema.tables.id, bk.tableId)))[0] : null;
  const zone = table ? (await db.select().from(schema.zones).where(eq(schema.zones.id, table.zoneId)))[0] : null;
  return ok({
    code: bk.code, name: bk.name, partySize: bk.partySize, startAt: bk.startAt, status: bk.status, holdUntil: bk.holdUntil,
    table: table ? { label: table.label, zone: zone?.name } : null,
    phoneTail: bk.phone.slice(-3), whatsapp: s.whatsapp, restaurantPhone: s.phone,
  });
});

const Cancel = z.object({ phone: z.string().min(3) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const { phone } = Cancel.parse(await req.json());
  const bk = await find(code);
  if (!bk) return fail(404, "ما لقينا حجز بهالرمز");
  const digits = phone.replace(/\D/g, "");
  if (!bk.phone.endsWith(digits.slice(-7))) return fail(403, "الرقم ما بيطابق الحجز");
  if (!["PENDING", "CONFIRMED", "REVIEW"].includes(bk.status)) return fail(400, "ما فيك تلغي هالحجز");
  await finishBooking(bk.id, "CANCELLED");
  return ok({ ok: true });
});
