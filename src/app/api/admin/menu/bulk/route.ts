import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";

const Body = z.object({
  percent: z.number().min(-90).max(500), // +20 raises everything 20%
  categoryId: z.string().optional(),
  roundTo: z.number().int().min(1).max(10000).default(50),
  dryRun: z.boolean().default(false),
});

/** raise / lower prices in one go (useful when the dollar moves) */
export const POST = handle(async (req: Request) => {
  const s = await requirePerm("menu");
  const b = Body.parse(await req.json());
  const items = await db.select().from(schema.menuItems).where(b.categoryId ? eq(schema.menuItems.categoryId, b.categoryId) : undefined);
  const changes = items.map((i) => ({ id: i.id, name: i.nameAr, from: i.price, to: Math.max(0, Math.round((i.price * (1 + b.percent / 100)) / b.roundTo) * b.roundTo) }))
    .filter((c) => c.to !== c.from);
  if (!b.dryRun) {
    for (const c of changes) {
      await db.update(schema.menuItems).set({ price: c.to, updatedAt: new Date() }).where(eq(schema.menuItems.id, c.id));
      await db.insert(schema.priceChanges).values({ itemId: c.id, oldPrice: c.from, newPrice: c.to, userId: s.uid });
    }
    await audit(s.uid, "menu.bulk_price", "menu", undefined, { percent: b.percent, categoryId: b.categoryId, count: changes.length });
  }
  return ok({ count: changes.length, changes: changes.slice(0, 200) });
});
