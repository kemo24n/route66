import { and, eq, inArray, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { publicMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { token } = await params;
  const [table] = await db.select().from(schema.tables).where(eq(schema.tables.qrToken, token));
  if (!table || !table.active) return fail(404, "رمز الطاولة غير صحيح");
  const s = await getSettings();
  const deviceId = new URL(req.url).searchParams.get("device") || "";
  const since = new Date(Date.now() - 3 * 3600 * 1000);
  const reqs = deviceId
    ? await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.tableId, table.id), eq(schema.serviceRequests.deviceId, deviceId), gte(schema.serviceRequests.createdAt, since)))
    : [];
  const openTypes = (await db.select({ type: schema.serviceRequests.type }).from(schema.serviceRequests)
    .where(and(eq(schema.serviceRequests.tableId, table.id), inArray(schema.serviceRequests.status, ["OPEN", "ACK"])))).map((r) => r.type);
  return ok({
    table: { label: table.label },
    restaurant: { name: s.restaurantName, currency: s.currencyLabel },
    qrOrdering: s.qrOrderingEnabled,
    categories: await publicMenu(),
    openTypes,
    myRequests: reqs.map((r) => ({ id: r.id, type: r.type, status: r.status, createdAt: r.createdAt })),
  });
});
