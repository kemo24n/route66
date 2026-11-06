import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/roles";
import { loadOrder, openOrderForTable } from "@/lib/orders";
import { getSettings, audit } from "@/lib/settings";
import { computeTotals } from "@/lib/money";
import { publish } from "@/lib/events";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requirePerm(["pos", "accounting"]);
  const { id } = await params;
  const o = await loadOrder(id);
  if (!o) return fail(404, "الطلب مو موجود");
  const s = await getSettings();
  const totals = computeTotals(o.subtotal, o.discount, s.servicePercent, s.taxPercent);
  const invoice = o.status === "PAID" ? (await db.select().from(schema.invoices).where(eq(schema.invoices.orderId, id)))[0] : null;
  return ok({ order: o, totals, settings: { taxPercent: s.taxPercent, servicePercent: s.servicePercent, usdRate: s.usdRate, currency: s.currencyLabel }, invoice });
});

const Patch = z.object({
  guests: z.number().int().min(1).max(40).optional(),
  notes: z.string().max(300).nullable().optional(),
  discount: z.number().int().min(0).optional(),
  tableId: z.string().optional(), // move table
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("pos");
  const { id } = await params;
  const b = Patch.parse(await req.json());
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!o || o.status !== "OPEN") return fail(400, "الطلب مسكّر");
  if (b.discount !== undefined && b.discount !== o.discount && !can(s.role, "checkout")) return fail(403, "الخصم من صلاحية الكاشير أو المدير");
  if (b.tableId && b.tableId !== o.tableId) {
    const other = await openOrderForTable(b.tableId);
    if (other) return fail(409, "الطاولة التانية عليها طلب مفتوح");
  }
  await db.update(schema.orders).set(b).where(and(eq(schema.orders.id, id), eq(schema.orders.status, "OPEN")));
  if (b.discount !== undefined) await audit(s.uid, "order.discount", "order", id, { discount: b.discount });
  if (b.tableId) await audit(s.uid, "order.move", "order", id, { from: o.tableId, to: b.tableId });
  publish("floor", "order", { id });
  return ok({ ok: true });
});
