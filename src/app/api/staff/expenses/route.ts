import { z } from "zod";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { businessDay, businessDayRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requirePerm(["accounting", "shifts"]);
  const day = new URL(req.url).searchParams.get("day") || businessDay();
  const { start, end } = businessDayRange(day);
  const rows = await db.select().from(schema.expenses).where(and(gte(schema.expenses.createdAt, start), lt(schema.expenses.createdAt, end))).orderBy(desc(schema.expenses.createdAt));
  return ok({ expenses: rows });
});

const Body = z.object({ category: z.string().trim().min(1).max(40), amount: z.number().int().positive(), note: z.string().max(200).optional() });

export const POST = handle(async (req: Request) => {
  const s = await requirePerm(["accounting", "shifts"]);
  const b = Body.parse(await req.json());
  const [open] = await db.select().from(schema.shifts).where(and(eq(schema.shifts.userId, s.uid), isNull(schema.shifts.closedAt)));
  const [e] = await db.insert(schema.expenses).values({ ...b, userId: s.uid, shiftId: open?.id ?? null }).returning();
  return ok(e);
});
