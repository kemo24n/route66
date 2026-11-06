import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };

/** send all draft lines to the kitchen / bar screens */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  await requirePerm("pos");
  const { id } = await params;
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!o || o.status !== "OPEN") return fail(400, "الطلب مسكّر");
  const sent = await db.update(schema.orderItems).set({ status: "NEW", sentAt: new Date() })
    .where(and(eq(schema.orderItems.orderId, id), eq(schema.orderItems.status, "DRAFT"))).returning({ id: schema.orderItems.id });
  if (!sent.length) return fail(400, "ما في أصناف جديدة للإرسال");
  publish("kitchen", "new", { orderId: id, count: sent.length });
  publish("floor", "order", { id });
  return ok({ sent: sent.length });
});
