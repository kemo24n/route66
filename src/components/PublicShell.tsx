"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Arrow } from "./Signs";

/** "open now" computed in Aleppo time, handles closing after midnight */
export function useOpenState(open: string, close: string) {
  const [s, setS] = useState<{ open: boolean; label: string } | null>(null);
  useEffect(() => {
    const calc = () => {
      const now = new Date(Date.now() + 180 * 60000);
      const m = now.getUTCHours() * 60 + now.getUTCMinutes();
      const toM = (t: string) => { const [h, mm] = t.split(":").map(Number); return h * 60 + mm; };
      const o = toM(open), c = toM(close);
      const isOpen = c > o ? m >= o && m < c : m >= o || m < c;
      setS({ open: isOpen, label: isOpen ? `مفتوح هلق · لـ ${close}` : `مسكّر · منفتح ${open}` });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [open, close]);
  return s;
}

export function PublicHeader({ openTime = "10:00", closeTime = "01:00", phone = "0962022020" }: { openTime?: string; closeTime?: string; phone?: string }) {
  const path = usePathname();
  const st = useOpenState(openTime, closeTime);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 24);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const links = [["/", "الرئيسية"], ["/menu", "المنيو"], ["/book", "احجز طاولة"]] as const;

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-paper/90 shadow-[0_1px_0_#15170F] backdrop-blur-md" : "bg-transparent"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <motion.img src="/img/logo.svg" alt="Route 66" className="h-11 w-11" whileHover={{ rotate: -12, scale: 1.06 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} />
          <div className="leading-none">
            <div className="font-sign text-[17px] font-black tracking-tight">ROUTE 66</div>
            <div className="mt-1 text-[11px] text-coal-mute">كافيه ومطعم · حلب</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.slice(0, 2).map(([href, l]) => (
            <Link key={href} href={href} className="relative px-4 py-2 text-[15px] font-medium">
              {l}
              {path === href && <motion.span layoutId="navline" className="absolute inset-x-3 -bottom-0.5 h-[3px] rounded-full bg-forest" />}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {st && (
            <a href={`tel:${phone}`} className="hidden items-center gap-2 rounded-full border-2 border-coal/15 px-3 py-1.5 text-xs font-medium sm:flex">
              <span className={`relative flex h-2.5 w-2.5`}>
                {st.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-leaf opacity-60" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${st.open ? "bg-forest-sign" : "bg-tail"}`} />
              </span>
              <span className="num">{st.label}</span>
            </a>
          )}
          <Link href="/book" className="pbtn-go hidden px-4 py-2 text-sm sm:inline-flex">احجز طاولة <Arrow className="h-4 w-4" /></Link>
          <button onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-[10px] border-2 border-coal md:hidden" aria-label="القائمة">
            <span className="flex flex-col gap-[5px]"><i className="block h-[2.5px] w-5 bg-coal" /><i className="block h-[2.5px] w-3.5 bg-coal" /></span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[80] flex flex-col bg-forest text-paper md:hidden" initial={{ clipPath: "circle(0% at 90% 5%)" }} animate={{ clipPath: "circle(150% at 90% 5%)" }} exit={{ clipPath: "circle(0% at 90% 5%)" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <div className="flex items-center justify-between px-4 py-3">
              <img src="/img/logo.svg" alt="" className="h-11 w-11" />
              <button onClick={() => setMenu(false)} className="grid h-11 w-11 place-items-center rounded-[10px] border-2 border-paper text-xl" aria-label="إغلاق">✕</button>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2 px-6">
              {links.map(([href, l], i) => (
                <motion.div key={href} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
                  <Link href={href} onClick={() => setMenu(false)} className="block py-2 font-display text-6xl leading-tight">{l}</Link>
                </motion.div>
              ))}
            </div>
            <div className="dash-line mx-6 mb-6 h-[6px] opacity-80" />
            {st && <div className="px-6 pb-8 text-sm opacity-80 num">{st.label}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function PublicFooter({ phone, address }: { phone: string; address: string }) {
  return (
    <footer className="road relative mt-24 overflow-hidden text-paper">
      <div className="dash-line h-[6px] w-full opacity-90" />
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="font-display text-5xl leading-none">نشوفك عالطريق.</div>
          <p className="mt-4 max-w-sm text-sm text-paper/60">برغر، سندويش، حلو وقهوة. وشاشة كبيرة للماتشات.</p>
        </div>
        <div className="space-y-1 text-sm">
          <div className="eyebrow mb-3 text-line">العنوان</div>
          <div>{address}</div>
          <a href="https://maps.google.com/?q=Route+66+Cafe+Mogambo+Aleppo" target="_blank" rel="noreferrer" className="inline-block border-b border-paper/30 pb-0.5 text-paper/70 hover:text-line">افتح عالخريطة</a>
        </div>
        <div className="space-y-1 text-sm">
          <div className="eyebrow mb-3 text-line">للحجز</div>
          <a href={`tel:${phone}`} className="num block text-2xl font-black hover:text-line">{phone}</a>
          <a href="https://www.instagram.com/route66_cafe_/" target="_blank" rel="noreferrer" dir="ltr" className="inline-block text-paper/70 hover:text-line">@route66_cafe_</a>
        </div>
      </div>
      <div className="select-none overflow-hidden whitespace-nowrap px-4 pb-2 text-center font-sign text-[17vw] font-black leading-[.8] text-paper/[.06]" dir="ltr">ROUTE 66</div>
      <div className="border-t border-paper/10 py-4 text-center text-[11px] text-paper/35" dir="ltr">Powered by Solunera · @soluneragency</div>
    </footer>
  );
}
