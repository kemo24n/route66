import { z } from "zod";
import { and, desc, eq, inArray, isNull, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function shiftSummary(shiftId: string, openingCash: number) {
  const invs = await db.select({ id: schema.invoices.id, total: schema.invoices.total }).from(schema.invoices).where(eq(schema.invoices.shiftId, shiftId));
  const pays = invs.length ? await db.select().from(schema.payments).where(inArray(schema.payments.invoiceId, invs.map((i) => i.id))) : [];
  const [{ e }] = await db.select({ e: sum(schema.expenses.amount) }).from(schema.expenses).where(eq(schema.expenses.shiftId, shiftId));
  const by = (m: string) => pays.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
  const usdCash = pays.filter((p) => p.method === "CASH_USD").reduce((a, p) => a + p.originalAmount, 0);
  const expenses = Number(e ?? 0);
  const cashSyp = by("CASH_SYP");
  return {
    invoices: invs.length, sales: invs.reduce((a, i) => a + i.total, 0),
    cashSyp, cashUsdSyp: by("CASH_USD"), cashUsd: usdCash, shamCash: by("SHAM_CASH"), card: by("CARD"),
    expenses, expectedCash: openingCash + cashSyp - expenses,
  };
}

export const GET = handle(async () => {
  const s = await requirePerm(["shifts", "checkout"]);
  const [open] = await db.select().from(schema.shifts).where(and(eq(schema.shifts.userId, s.uid), isNull(schema.shifts.closedAt)));
  const recent = await db.select().from(schema.shifts).orderBy(desc(schema.shifts.openedAt)).limit(20);
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return ok({
    current: open ? { ...open, summary: await shiftSummary(open.id, open.openingCash) } : null,
    recent: recent.map((r) => ({ ...r, user: users.find((u) => u.id === r.userId)?.name })),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), openingCash: z.number().int().min(0) }),
  z.object({ action: z.literal("close"), countedCash: z.number().int().min(0), notes: z.string().max(300).optional() }),
]);

export const POST = handle(async (req: Request) => {
  const s = await requirePerm(["shifts", "checkout"]);
  const b = Body.parse(await req.json());
  const [open] = await db.select().from(schema.shifts).where(and(eq(schema.shifts.userId, s.uid), isNull(schema.shifts.closedAt)));
  if (b.action === "open") {
    if (open) return fail(400, "عندك وردية مفتوحة");
    const [sh] = await db.insert(schema.shifts).values({ userId: s.uid, openingCash: b.openingCash }).returning();
    await audit(s.uid, "shift.open", "shift", sh.id, { openingCash: b.openingCash });
    return ok(sh);
  }
  if (!open) return fail(400, "ما في وردية مفتوحة");
  const sum = await shiftSummary(open.id, open.openingCash);
  const [sh] = await db.update(schema.shifts).set({ closedAt: new Date(), countedCash: b.countedCash, expectedCash: sum.expectedCash, notes: b.notes ?? open.notes }).where(eq(schema.shifts.id, open.id)).returning();
  await audit(s.uid, "shift.close", "shift", sh.id, { counted: b.countedCash, expected: sum.expectedCash });
  return ok({ ...sh, summary: sum, difference: b.countedCash - sum.expectedCash });
});
