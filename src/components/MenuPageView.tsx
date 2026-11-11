"use client";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "./PublicShell";
import { MenuList, type MenuCat } from "./MenuList";
import { SignWords } from "./motion";
import { Arrow } from "./Signs";
import { motion } from "motion/react";

export function MenuPageView({ categories, settings }: { categories: MenuCat[]; settings: { phone: string; address: string; openTime: string; closeTime: string; currency: string } }) {
  const count = categories.reduce((a, c) => a + c.items.length, 0);
  return (
    <div className="pub grain">
      <PublicHeader openTime={settings.openTime} closeTime={settings.closeTime} phone={settings.phone} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="flex flex-wrap items-end justify-between gap-6 pb-8 pt-6">
          <div>
            <div className="eyebrow text-forest">The menu · {count} items</div>
            <h1 className="mt-2 font-display text-[clamp(72px,14vw,160px)] leading-[.85]"><SignWords text="المنيو" /></h1>
          </div>
          <motion.div initial={{ opacity: 0, rotate: 6, y: 20 }} animate={{ opacity: 1, rotate: -3, y: 0 }} transition={{ delay: 0.4, type: "spring" }}
            className="max-w-xs rounded-[14px] border-[3px] border-coal bg-line p-4 shadow-hard">
            <div className="font-display text-2xl leading-tight">قاعد عندنا؟</div>
            <p className="mt-1 text-sm">امسح الكود يلي عالطاولة، واطلب أو نادي الويتر من موبايلك.</p>
            <Link href="/book" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline decoration-2 underline-offset-4">أو احجز طاولة <Arrow className="h-4 w-4" /></Link>
          </motion.div>
        </section>
        <MenuList categories={categories} currency={settings.currency} />
        <p className="mt-10 text-center text-xs text-coal-mute">الأسعار بالليرة السورية الجديدة وممكن تتغير.</p>
      </main>
      <PublicFooter phone={settings.phone} address={settings.address} />
    </div>
  );
}
