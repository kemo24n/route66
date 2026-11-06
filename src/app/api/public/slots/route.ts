import { z } from "zod";
import { handle, ok, fail } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { slotsWithAvailability, bookableDates } from "@/lib/bookings";

export const dynamic = "force-dynamic";
const Q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), party: z.coerce.number().int().min(1).max(40).default(2) });

export const GET = handle(async (req: Request) => {
  const s = await getSettings();
  const q = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const dates = bookableDates(s);
  if (!s.bookingEnabled) return ok({ enabled: false, dates, slots: [] });
  const date = q.date ?? dates[0];
  if (!dates.includes(date)) return fail(400, "التاريخ خارج فترة الحجز");
  return ok({ enabled: true, dates, date, maxParty: s.maxPartySize, slots: await slotsWithAvailability(date, q.party, s) });
});
