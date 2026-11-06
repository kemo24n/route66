import { z } from "zod";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";
import { saveImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePerm("menu");
  const cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.sort));
  const items = await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort));
  return ok({ categories: cats, items });
});

const Body = z.object({
  categoryId: z.string(), nameAr: z.string().trim().min(1).max(80), nameEn: z.string().trim().max(80).default(""),
  descAr: z.string().max(300).default(""), price: z.number().int().min(0), station: z.enum(["KITCHEN", "BAR"]).default("KITCHEN"),
  image: z.string().max(3_000_000).optional(), // data URL from the upload field
});

export const POST = handle(async (req: Request) => {
  const s = await requirePerm("menu");
  const b = Body.parse(await req.json());
  const key = ((b.nameEn || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item") + "-" + Math.random().toString(36).slice(2, 6);
  const image = await saveImage(b.image, key);
  const [it] = await db.insert(schema.menuItems).values({ ...b, key, image: image ?? null, sort: 999 }).returning();
  await audit(s.uid, "menu.create", "menu_item", it.id, { name: it.nameAr, price: it.price });
  return ok(it);
});
