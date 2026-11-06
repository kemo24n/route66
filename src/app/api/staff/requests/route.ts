import { asc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePerm("requests");
  const reqs = await db.select().from(schema.serviceRequests).where(inArray(schema.serviceRequests.status, ["OPEN", "ACK"])).orderBy(asc(schema.serviceRequests.createdAt));
  const tbls = await db.select({ id: schema.tables.id, label: schema.tables.label }).from(schema.tables);
  const items = await db.select({ id: schema.menuItems.id, nameAr: schema.menuItems.nameAr, price: schema.menuItems.price }).from(schema.menuItems);
  return ok({
    requests: reqs.map((r) => ({
      id: r.id, type: r.type, status: r.status, createdAt: r.createdAt, note: r.note, tableId: r.tableId,
      table: tbls.find((t) => t.id === r.tableId)?.label,
      items: r.payload?.items?.map((i) => ({ ...i, name: items.find((m) => m.id === i.menuItemId)?.nameAr ?? "؟", price: items.find((m) => m.id === i.menuItemId)?.price ?? 0 })) ?? [],
    })),
  });
});
