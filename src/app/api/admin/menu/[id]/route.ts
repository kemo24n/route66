import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";
import { saveImage } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  categoryId: z.string(), nameAr: z.string().trim().min(1).max(80), nameEn: z.string().trim().max(80), descAr: z.string().max(300),
  price: z.number().int().min(0), available: z.boolean(), station: z.enum(["KITCHEN", "BAR"]), sort: z.number().int(),
  image: z.string().max(3_000_000).nullable(),
}).partial();

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requirePerm("menu");
  const { id } = await params;
  const hist = await db.select().from(schema.priceChanges).where(eq(schema.priceChanges.itemId, id)).orderBy(desc(schema.priceChanges.createdAt)).limit(20);
  return ok({ history: hist });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requirePerm("menu");
  const { id } = await params;
  const b = Patch.parse(await req.json());
  const [cur] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id));
  if (!cur) return fail(404, "الصنف مو موجود");
  const set: Partial<typeof schema.menuItems.$inferInsert> = { ...b, image: undefined, updatedAt: new Date() };
  if (b.image === null) set.image = null;
  else if (b.image) set.image = (await saveImage(b.image, cur.key)) ?? cur.image;
  await db.update(schema.menuItems).set(set).where(eq(schema.menuItems.id, id));
  if (b.price !== undefined && b.price !== cur.price) {
    await db.insert(schema.priceChanges).values({ itemId: id, oldPrice: cur.price, newPrice: b.price, userId: s.uid });
    await audit(s.uid, "menu.price", "menu_item", id, { name: cur.nameAr, from: cur.price, to: b.price });
  }
  return ok({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requirePerm("menu");
  const { id } = await params;
  const used = await db.select({ id: schema.orderItems.id }).from(schema.orderItems).where(eq(schema.orderItems.menuItemId, id)).limit(1);
  if (used.length) {
    // keep history intact: hide instead of delete
    await db.update(schema.menuItems).set({ available: false, sort: 9999 }).where(eq(schema.menuItems.id, id));
    await audit(s.uid, "menu.hide", "menu_item", id);
    return ok({ hidden: true });
  }
  await db.delete(schema.menuItems).where(eq(schema.menuItems.id, id));
  await audit(s.uid, "menu.delete", "menu_item", id);
  return ok({ deleted: true });
});
