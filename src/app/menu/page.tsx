import { getSettings } from "@/lib/settings";
import { publicMenu } from "@/lib/menu";
import { MenuPageView } from "@/components/MenuPageView";

export const dynamic = "force-dynamic";
export const metadata = { title: "المنيو | Route 66" };

export default async function MenuPage() {
  const s = await getSettings();
  const cats = await publicMenu();
  return <MenuPageView categories={cats} settings={{ phone: s.phone, address: s.addressAr, openTime: s.openTime, closeTime: s.closeTime, currency: s.currencyLabel }} />;
}
