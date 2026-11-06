import { desc, ilike, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request) => {
  await requirePerm(["bookings", "risk"]);
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  const C = schema.customers;
  const rows = await db.select().from(C).where(q ? or(ilike(C.name, `%${q}%`), ilike(C.phone, `%${q}%`)) : undefined).orderBy(desc(C.noShows), desc(C.completed)).limit(100);
  return ok({ customers: rows });
});
