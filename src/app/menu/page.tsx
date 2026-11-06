import { PublicHeader, PublicFooter } from "@/components/PublicShell";
import { MenuBrowser } from "@/components/MenuBrowser";
import { getSettings } from "@/lib/settings";
import { publicMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";
export const metadata = { title: "المنيو | Route 66" };

export default async function MenuPage() {
  const s = await getSettings();
  const cats = await publicMenu();
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <h1 className="text-3xl font-bold">المنيو</h1>
        <p className="mt-1 text-sm text-white/50">الأسعار بالليرة السورية الجديدة</p>
        <MenuBrowser categories={cats} currency={s.currencyLabel} />
      </main>
      <PublicFooter phone={s.phone} address={s.addressAr} />
    </>
  );
}
