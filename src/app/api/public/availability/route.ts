import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { availability } from "@/lib/bookings";

export const dynamic = "force-dynamic";
const Q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), party: z.coerce.number().int().min(1).max(40) });

export const GET = handle(async (req: Request) => {
  const s = await getSettings();
  const q = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const a = await availability(q.date, q.time, q.party, s);
  return ok({ zones: a.zones, tables: a.tables, startAt: a.startAt, endAt: a.endAt });
});
