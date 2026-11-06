import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(50).default(1), notes: z.string().trim().max(150).optional() });

/** add a line to the order as DRAFT (not sent to the kitchen yet). Same item+notes stacks. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  await requirePerm("pos");
  const { id } = await params;
  const b = Body.parse(await req.json());
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!o || o.status !== "OPEN") return fail(400, "الطلب مسكّر");
  const [m] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, b.menuItemId));
  if (!m) return fail(404, "الصنف مو موجود");
  if (!m.available) return fail(400, "الصنف مو متوفر هلق");
  const notes = b.notes || null;
  const [same] = await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.orderId, id), eq(schema.orderItems.menuItemId, m.id), eq(schema.orderItems.status, "DRAFT")));
  if (same && (same.notes ?? null) === notes) {
    await db.update(schema.orderItems).set({ qty: same.qty + b.qty }).where(eq(schema.orderItems.id, same.id));
  } else {
    await db.insert(schema.orderItems).values({ orderId: id, menuItemId: m.id, nameAr: m.nameAr, unitPrice: m.price, qty: b.qty, notes, station: m.station });
  }
  publish("floor", "order", { id });
  return ok({ ok: true });
});
