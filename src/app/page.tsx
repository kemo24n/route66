import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/PublicShell";
import { getSettings } from "@/lib/settings";
import { publicMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";

const FEATURED = ["beef-steak-burger", "chicken-route", "fajita-30cm", "caesar-salad", "route-66-station-mix", "special-cake-route66", "crepe-pistachio", "soft-tropical"];

export default async function Home() {
  const s = await getSettings();
  const cats = await publicMenu();
  const all = cats.flatMap((c) => c.items);
  const featured = FEATURED.map((k) => all.find((i) => i.key === k)).filter((i): i is NonNullable<typeof i> => !!i && !!i.image);

  return (
    <>
      <PublicHeader />
      <section className="relative overflow-hidden">
        <img src="/img/terrace_tables.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/30" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-24 sm:pb-24 sm:pt-32">
          <div className="max-w-xl">
            <span className="chip bg-brand-400/20 text-brand-100">حلب · الموكامبو · سنتر الاتحاد</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">طاولتك جاهزة<br /><span className="text-neon">قبل ما توصل</span></h1>
            <p className="mt-4 text-base text-white/70">شوف خريطة المحل، اختار الطاولة يلي بتعجبك واحجزها بدقيقة. وإذا قاعد عندنا، امسح رمز <span dir="ltr">QR</span> عالطاولة ونادي الويتر من موبايلك.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/book" className="btn-neon px-6 py-3 text-base">احجز طاولة</Link>
              <Link href="/menu" className="btn-ghost px-6 py-3 text-base">شوف المنيو</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">من مطبخ روت</h2>
          <Link href="/menu" className="text-sm text-neon hover:underline">المنيو كامل</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {featured.map((i) => (
            <Link key={i.id} href={`/menu#${i.key}`} className="group overflow-hidden rounded-2xl bg-ink-800">
              <div className="aspect-[4/5] overflow-hidden">
                <img src={i.image!} alt={i.nameAr} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold">{i.nameAr}</div>
                <div className="text-xs text-white/50">{i.nameEn}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3">
        {[
          ["اختار طاولتك", "الخريطة بتوريك الطاولات الفاضية بالوقت يلي بدك ياه. صالة أو تراس، إنت بتقرر."],
          ["تأكيد سريع", "أغلب الحجوزات بتتأكد فوراً. إذا احتجنا تأكيد، بتبعتلنا رسالة واتساب وبس."],
          ["نادي الويتر", "امسح الرمز يلي عالطاولة: اطلب، نادي الويتر، أو اطلب الحساب بكبسة."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <div className="text-lg font-bold text-neon">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="grid overflow-hidden rounded-3xl bg-brand-900 sm:h-[380px] sm:grid-cols-2">
          <img src="/img/storefront_sign.jpg" alt="Route 66" className="h-64 w-full object-cover object-top sm:h-[380px]" />
          <div className="p-8">
            <h2 className="text-2xl font-bold">عنا شاشة كبيرة للمباريات</h2>
            <p className="mt-3 text-white/70">بأيام الماتشات الطاولات بتخلص بسرعة. احجز من هلق واختار مكان بيطل عالشاشة.</p>
            <div className="mt-5 text-sm text-white/60">
              <div>الدوام: من <span className="num">{s.openTime}</span> لـ <span className="num">{s.closeTime}</span></div>
              <div className="mt-1">{s.addressAr}</div>
            </div>
            <Link href="/book" className="btn-neon mt-6">احجز للماتش</Link>
          </div>
        </div>
      </section>

      <PublicFooter phone={s.phone} address={s.addressAr} />
    </>
  );
}
