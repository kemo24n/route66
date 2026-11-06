import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/roles";
import { audit } from "@/lib/settings";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ reason: z.string().trim().min(2).max(200) });

/** cancel an open order. Empty / draft-only orders: anyone with POS. Sent orders: manager. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("pos");
  const { id } = await params;
  const { reason } = Body.parse(await req.json());
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
  const sent = items.some((i) => i.status !== "DRAFT" && i.status !== "VOID");
  if (sent && !can(s.role, "void")) return fail(403, "إلغاء طلب انبعت للمطبخ بدو مدير");
  const [o] = await db.update(schema.orders).set({ status: "CANCELLED", closedAt: new Date(), notes: reason })
    .where(and(eq(schema.orders.id, id), eq(schema.orders.status, "OPEN"))).returning();
  if (!o) return fail(400, "الطلب مسكّر");
  await db.update(schema.orderItems).set({ status: "VOID", voidReason: reason }).where(eq(schema.orderItems.orderId, id));
  await audit(s.uid, "order.cancel", "order", id, { reason, items: items.length });
  publish("floor", "order", { id });
  publish("kitchen", "void", {});
  return ok({ ok: true });
});
