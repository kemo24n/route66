import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { tableFreeTimes } from "@/lib/bookings";

export const dynamic = "force-dynamic";
const Q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tableId: z.string().min(1) });

export const GET = handle(async (req: Request) => {
  const s = await getSettings();
  const q = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok({ times: await tableFreeTimes(q.date, q.tableId, s) });
});
