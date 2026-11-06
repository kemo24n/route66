import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail, clientIp, rateLimit } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { publish } from "@/lib/events";
import { schema as S } from "@/db";

type Ctx = { params: Promise<{ token: string }> };

const Body = z.object({
  type: z.enum(["CALL_WAITER", "BILL", "ORDER"]),
  deviceId: z.string().min(4).max(80),
  note: z.string().trim().max(200).optional(),
  items: z.array(z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(10), notes: z.string().max(120).optional() })).max(20).optional(),
});

/**
 * Requests from the table QR page. Nothing goes straight to the kitchen:
 * a waiter has to accept an ORDER request first. That's what stops fake orders
 * from someone who copied the QR link and is not actually sitting at the table.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { token } = await params;
  const ip = clientIp(req);
  const body = Body.parse(await req.json());
  const [table] = await db.select().from(schema.tables).where(eq(schema.tables.qrToken, token));
  if (!table || !table.active) return fail(404, "رمز الطاولة غير صحيح");
  const s = await getSettings();

  if (!rateLimit(`qr:${body.deviceId}`, 8, 10 * 60_000) || !rateLimit(`qr-ip:${ip}`, 20, 10 * 60_000)) {
    return fail(429, "طلبات كتيرة، النادل جاي لعندك");
  }
  const blocked = await db.select({ id: S.blockEntries.id }).from(S.blockEntries)
    .where(and(eq(S.blockEntries.type, "DEVICE"), eq(S.blockEntries.value, body.deviceId)));
  if (blocked.length) return fail(403, "اطلب من النادل مباشرة لو سمحت");
  if (body.type === "ORDER") {
    if (!s.qrOrderingEnabled) return fail(400, "الطلب من الموبايل موقف، اطلب من النادل");
    if (!body.items?.length) return fail(400, "السلة فاضية");
    const ids = body.items.map((i) => i.menuItemId);
    const found = await db.select().from(schema.menuItems).where(inArray(schema.menuItems.id, ids));
    if (found.length !== new Set(ids).size || found.some((f) => !f.available)) return fail(400, "في صنف مو متوفر هلق، حدّث الصفحة");
    const totalQty = body.items.reduce((a, i) => a + i.qty, 0);
    if (totalQty > 30) return fail(400, "الكمية كبيرة، اطلب من النادل مباشرة");
  }

  // one open request of each type per table is enough
  const [existing] = await db.select().from(schema.serviceRequests).where(and(
    eq(schema.serviceRequests.tableId, table.id), eq(schema.serviceRequests.type, body.type), inArray(schema.serviceRequests.status, ["OPEN", "ACK"]),
  ));
  if (existing && body.type !== "ORDER") return ok({ id: existing.id, status: existing.status, duplicate: true });

  const [r] = await db.insert(schema.serviceRequests).values({
    tableId: table.id, type: body.type, deviceId: body.deviceId, ip, note: body.note,
    payload: body.type === "ORDER" ? { items: body.items } : null,
  }).returning();
  publish("requests", "created", { id: r.id, type: r.type, table: table.label });
  publish("floor", "request", { tableId: table.id });
  return ok({ id: r.id, status: r.status });
});
