import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";

export async function publicMenu(includeUnavailable = false) {
  const cats = await db.select().from(schema.categories).where(eq(schema.categories.active, true)).orderBy(asc(schema.categories.sort));
  const items = await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort));
  return cats.map((c) => ({
    id: c.id, key: c.key, nameAr: c.nameAr, nameEn: c.nameEn,
    items: items.filter((i) => i.categoryId === c.id && (includeUnavailable || i.available)).map((i) => ({
      id: i.id, key: i.key, nameAr: i.nameAr, nameEn: i.nameEn, descAr: i.descAr, price: i.price, image: i.image, available: i.available, station: i.station,
    })),
  })).filter((c) => c.items.length);
}
