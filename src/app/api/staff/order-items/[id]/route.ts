import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/roles";
import { audit } from "@/lib/settings";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };
const Patch = z.object({ qty: z.number().int().min(1).max(50).optional(), notes: z.string().max(150).nullable().optional(), status: z.literal("SERVED").optional() });

async function lineWithOrder(id: string) {
  const [line] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, id));
  if (!line) return null;
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, line.orderId));
  return { line, order };
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await requirePerm("pos");
  const { id } = await params;
  const b = Patch.parse(await req.json());
  const x = await lineWithOrder(id);
  if (!x || x.order.status !== "OPEN") return fail(400, "الطلب مسكّر");
  if (b.status === "SERVED") {
    if (x.line.status !== "READY" && x.line.status !== "PREPARING" && x.line.status !== "NEW") return fail(400, "الصنف لسا ما انبعت");
    await db.update(schema.orderItems).set({ status: "SERVED" }).where(eq(schema.orderItems.id, id));
  } else {
    if (x.line.status !== "DRAFT") return fail(400, "الصنف انبعت للمطبخ، ما بينعدل. إذا بدك تلغيه استخدم الإلغاء");
    await db.update(schema.orderItems).set({ qty: b.qty ?? x.line.qty, notes: b.notes === undefined ? x.line.notes : b.notes }).where(eq(schema.orderItems.id, id));
  }
  publish("floor", "order", { id: x.order.id });
  publish("kitchen", "changed", {});
  return ok({ ok: true });
});

const Del = z.object({ reason: z.string().trim().max(150).optional() });

/** draft lines are deleted. lines already sent are voided (manager only, with a reason) */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("pos");
  const { id } = await params;
  const x = await lineWithOrder(id);
  if (!x || x.order.status !== "OPEN") return fail(400, "الطلب مسكّر");
  if (x.line.status === "DRAFT") {
    await db.delete(schema.orderItems).where(eq(schema.orderItems.id, id));
  } else {
    if (!can(s.role, "void")) return fail(403, "إلغاء صنف انبعت للمطبخ بدو مدير");
    const { reason } = Del.parse(await req.json().catch(() => ({})));
    if (!reason) return fail(400, "اكتب سبب الإلغاء");
    await db.update(schema.orderItems).set({ status: "VOID", voidReason: reason }).where(eq(schema.orderItems.id, id));
    await audit(s.uid, "item.void", "order_item", id, { reason, name: x.line.nameAr, qty: x.line.qty, price: x.line.unitPrice });
    publish("kitchen", "void", { id });
  }
  publish("floor", "order", { id: x.order.id });
  return ok({ ok: true });
});
