import { getSettings } from "@/lib/settings";
import { publicMenu } from "@/lib/menu";
import { HomeView } from "@/components/HomeView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSettings();
  const cats = await publicMenu();
  return (
    <HomeView
      settings={{ phone: s.phone, address: s.addressAr, openTime: s.openTime, closeTime: s.closeTime, currency: s.currencyLabel }}
      categories={cats.map((c) => ({ key: c.key, nameAr: c.nameAr, nameEn: c.nameEn, items: c.items.map((i) => ({ id: i.id, key: i.key, nameAr: i.nameAr, nameEn: i.nameEn, price: i.price, image: i.image, descAr: i.descAr })) }))}
    />
  );
}
