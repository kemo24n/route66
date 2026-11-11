"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { PublicHeader, PublicFooter } from "./PublicShell";
import { Reveal, SignWords, Marquee, RoadStrip, Magnetic, CountUp, ease } from "./motion";
import { Shield, Arrow, Car } from "./Signs";
import { BookingMap } from "./BookingMap";
import type { MapTable } from "./FloorMap";

type Item = { id: string; key: string; nameAr: string; nameEn: string; price: number; image: string | null; descAr: string };
type Cat = { key: string; nameAr: string; nameEn: string; items: Item[] };
type S = { phone: string; address: string; openTime: string; closeTime: string; currency: string };

const DECK = ["beef-steak-burger", "route-66-station-mix", "crepe-pistachio", "fajita-30cm", "soft-tropical", "chicken-route", "onion-rings"];
const BOARD = ["beef-steak-burger", "ranch-burger", "zinger-graffite", "chicken-route", "creamy-chicken", "fajita-30cm", "caesar-salad", "route-66-station-mix", "crepe-pistachio", "special-cake-route66"];

export function HomeView({ settings, categories }: { settings: S; categories: Cat[] }) {
  const all = useMemo(() => categories.flatMap((c) => c.items), [categories]);
  const deck = DECK.map((k) => all.find((i) => i.key === k)).filter((i): i is Item => !!i?.image);
  const board = BOARD.map((k) => all.find((i) => i.key === k)).filter((i): i is Item => !!i);

  return (
    <div className="pub grain overflow-x-clip">
      <PublicHeader openTime={settings.openTime} closeTime={settings.closeTime} phone={settings.phone} />
      <Hero deck={deck} />
      <Ticker items={all} />
      <MenuBoard items={board} currency={settings.currency} />
      <FloorTeaser />
      <Stops />
      <MatchNight />
      <PublicFooter phone={settings.phone} address={settings.address} />
    </div>
  );
}

/* ---------------- hero ---------------- */

function Hero({ deck }: { deck: Item[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  return (
    <section ref={ref} className="relative">
      <div className="paper-lines pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:pb-24 md:pt-10">
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-3">
            <Shield n="66" className="h-12 w-11" />
            <div className="eyebrow text-coal-soft">Mogambo · Al Etihad Center · Aleppo</div>
          </motion.div>
          <h1 className="mt-5 font-display text-[clamp(64px,13vw,150px)] leading-[.86] tracking-tight">
            <SignWords text="على طريقتك." />
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }} className="mt-6 max-w-md text-lg leading-relaxed text-coal-soft">
            برغر بيتعمل قدامك، صحن ميكس للشلة، كريب وقهوة لآخر السهرة. اختار طاولتك من خريطة المحل قبل ما توصل.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.7, ease }} className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic><Link href="/book" className="pbtn-go px-7 py-4 text-lg">احجز طاولتك <Arrow className="h-5 w-5" /></Link></Magnetic>
            <Link href="/menu" className="pbtn-plain px-6 py-4 text-lg">شوف المنيو</Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-10 grid max-w-md grid-cols-3 border-y-2 border-coal/80 py-4 text-center">
            {[["13", "طاولة"], ["2", "صالة وتراس"], ["66", "صنف"]].map(([n, l], i) => (
              <div key={l} className={i ? "border-r-2 border-coal/20" : ""}>
                <dt className="num font-sign text-3xl font-black">{n}</dt>
                <dd className="text-xs text-coal-mute">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
        <motion.div style={{ y }} className="relative">
          <Deck items={deck} />
        </motion.div>
      </div>
      <RoadStrip className="h-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[22px] animate-[r66drive_14s_linear_infinite]" style={{ left: "-120px" }}><Car className="h-12 w-24" /></div>
        </div>
        <style>{`@keyframes r66drive{from{transform:translateX(0)}to{transform:translateX(calc(100vw + 240px))}}`}</style>
      </RoadStrip>
    </section>
  );
}

/** stacked photo cards: auto-shuffles, drag or tap the top card to throw it to the back */
function Deck({ items }: { items: Item[] }) {
  const [order, setOrder] = useState(items.map((_, i) => i));
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setOrder((o) => [...o.slice(1), o[0]]), 3200);
    return () => clearInterval(t);
  }, [paused, items.length]);
  const next = () => setOrder((o) => [...o.slice(1), o[0]]);
  const top = items[order[0]];
  const tilt = [-4, 5, -8, 9, -2, 6, -6];
  return (
    <div className="relative mx-auto aspect-[4/5] w-[min(88vw,440px)]" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      {order.slice(0, 4).reverse().map((idx, k, arr) => {
        const depth = arr.length - 1 - k;
        const it = items[idx];
        const isTop = depth === 0;
        return (
          <motion.div key={it.id} className="absolute inset-0 cursor-grab overflow-hidden rounded-[18px] border-[3px] border-coal bg-coal shadow-lift active:cursor-grabbing"
            style={{ zIndex: 10 - depth }}
            initial={false}
            animate={{ rotate: tilt[idx % tilt.length] * (isTop ? 0.4 : 1), scale: 1 - depth * 0.045, y: depth * -16, x: depth * (idx % 2 ? 10 : -10) }}
            transition={{ type: "spring", stiffness: 180, damping: 20 }}
            drag={isTop} dragSnapToOrigin dragElastic={0.6}
            onDragEnd={(_, i) => { if (Math.abs(i.offset.x) > 90 || Math.abs(i.offset.y) > 90) next(); }}
            onTap={isTop ? next : undefined}>
            <img src={it.image!} alt={it.nameAr} draggable={false} className="h-full w-full object-cover object-[50%_80%]" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-coal via-coal/70 to-transparent p-5 pt-16 text-paper">
              <div className="font-display text-3xl leading-none">{it.nameAr}</div>
              <div className="mt-1 font-sign text-xs font-extrabold uppercase tracking-[.2em] text-line">{it.nameEn}</div>
            </div>
          </motion.div>
        );
      })}
      <motion.div className="absolute -bottom-5 -left-4 z-20 rotate-[-8deg] rounded-full border-[3px] border-coal bg-line px-4 py-2 font-display text-xl shadow-hard-sm"
        animate={{ rotate: [-8, -3, -8] }} transition={{ repeat: Infinity, duration: 3 }}>
        اسحب الصورة
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div key={top?.id} className="sr-only">{top?.nameAr}</motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------- ticker ---------------- */

function Ticker({ items }: { items: Item[] }) {
  const names = items.slice(0, 18);
  return (
    <div className="border-y-[3px] border-coal bg-forest py-4 text-paper">
      <Marquee speed={70}>
        {names.map((i) => (
          <span key={i.id} className="flex items-center gap-6 px-6 font-display text-4xl md:text-5xl">
            {i.nameAr}
            <span className="text-line">✦</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}

/* ---------------- menu board ---------------- */

function MenuBoard({ items, currency }: { items: Item[]; currency: string }) {
  const [hover, setHover] = useState<Item | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6" onPointerMove={(e) => setPos({ x: e.clientX, y: e.clientY })}>
      <div className="grid gap-12 md:grid-cols-[.8fr_1.2fr]">
        <Reveal>
          <div className="eyebrow text-forest">Mile 01 · from the kitchen</div>
          <h2 className="mt-3 font-display text-6xl leading-[.95] md:text-7xl">الأكتر طلباً<br />هالأسبوع</h2>
          <p className="mt-5 max-w-sm text-coal-soft">مرّق على أي صنف لتشوف صورته. المنيو الكامل فيه {66} صنف بين برغر ووجبات وسندويش وحلو.</p>
          <Link href="/menu" className="pbtn-green mt-8">المنيو كامل <Arrow className="h-4 w-4" /></Link>
        </Reveal>
        <div className="relative rounded-[18px] border-[3px] border-coal bg-[#FBF7EE] p-6 shadow-hard md:p-10">
          <div className="absolute -top-4 right-8 rotate-[-2deg] bg-tail px-3 py-1 font-sign text-xs font-black uppercase tracking-widest text-paper">Today&apos;s board</div>
          <ul className="divide-y-2 divide-dashed divide-coal/15">
            {items.map((i, k) => (
              <Reveal as="li" key={i.id} delay={k * 0.04} y={14}>
                <Link href={`/menu#${i.key}`} className="group flex items-center gap-4 py-4" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                  <span className="num w-7 font-sign text-sm font-black text-coal-mute">{String(k + 1).padStart(2, "0")}</span>
                  {i.image && <img src={i.image} alt="" className="h-12 w-12 rounded-lg border-2 border-coal object-cover object-[50%_80%] md:hidden" />}
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold transition-colors group-hover:text-forest">{i.nameAr}</span>
                    <span className="block font-sign text-[11px] font-extrabold uppercase tracking-[.16em] text-coal-mute">{i.nameEn}</span>
                  </span>
                  <span className="leader" />
                  <span className="whitespace-nowrap font-sign text-xl font-black"><span className="num">{i.price.toLocaleString("en-US")}</span> <span className="text-xs font-semibold text-coal-mute">{currency}</span></span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
      <AnimatePresence>
        {hover?.image && (
          <motion.img key={hover.id} src={hover.image} alt="" className="pointer-events-none fixed z-[60] hidden h-64 w-52 rounded-2xl border-[3px] border-coal object-cover object-[50%_80%] shadow-lift md:block"
            initial={{ opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -4, left: pos.x + 24, top: pos.y - 130 }} exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.6 }} />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------------- live floor teaser ---------------- */

type BT = MapTable & { state: "free" | "busy" | "small" | "closed"; fit: boolean };

function FloorTeaser() {
  const [tables, setTables] = useState<BT[] | null>(null);
  const [when, setWhen] = useState<{ date: string; time: string } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const s = await fetch("/api/public/slots?party=2").then((r) => r.json());
        let date = s.date, slot = s.slots?.find((x: { available: boolean }) => x.available);
        if (!slot && s.dates?.[1]) {
          const s2 = await fetch(`/api/public/slots?party=2&date=${s.dates[1]}`).then((r) => r.json());
          date = s.dates[1];
          slot = s2.slots?.find((x: { available: boolean }) => x.available);
        }
        if (!slot) return;
        const a = await fetch(`/api/public/availability?date=${date}&time=${slot.time}&party=2`).then((r) => r.json());
        setTables(a.tables);
        setWhen({ date, time: slot.time });
      } catch {}
    })();
  }, []);
  const free = tables?.filter((t) => t.state === "free").length ?? 0;
  return (
    <section className="road relative overflow-hidden py-24 text-paper">
      <div className="dash-v absolute bottom-0 right-[8%] top-0 w-1 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[.75fr_1.25fr]">
        <Reveal>
          <div className="eyebrow text-line">Mile 02 · pick your spot</div>
          <h2 className="mt-3 font-display text-6xl leading-[.95] md:text-7xl">شوف المحل<br />قبل ما توصل.</h2>
          <p className="mt-5 max-w-sm text-paper/70">هي خريطة روت الحقيقية. الطاولات الخضرا فاضية، الحمرا محجوزة. اختار يلي بتعجبك وخلصنا.</p>
          {tables && when && (
            <div className="mt-8 inline-flex items-center gap-4 rounded-xl border-2 border-paper/15 bg-road-2 px-5 py-4">
              <span className="font-sign text-5xl font-black text-line"><CountUp value={free} /></span>
              <span className="text-sm leading-snug text-paper/75">طاولة فاضية<br />الساعة <span className="num">{when.time}</span></span>
            </div>
          )}
          <div className="mt-8"><Link href="/book" className="pbtn-go">اختار طاولتك <Arrow className="h-4 w-4" /></Link></div>
        </Reveal>
        <Reveal delay={0.1}>
          <Link href="/book" className="block overflow-hidden rounded-[18px] border-[3px] border-paper/20 bg-[#080e0a]">
            {tables ? <BookingMap tables={tables} selectedId={null} onSelect={() => {}} /> : <div className="aspect-[1130/730] animate-pulse bg-road-3" />}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- how it works ---------------- */

function Stops() {
  const steps = [
    ["1", "اختار الوقت", "عدد الأشخاص، اليوم والساعة. الأوقات المليانة بتبيّن قدامك."],
    ["2", "اختار طاولتك", "من خريطة المحل: جوا بالصالة أو برا عالتراس، قرب الشاشة أو بالزاوية."],
    ["3", "بتوصلك تذكرة", "رقم حجز وتذكرة عالموبايل. إذا لزم تأكيد، رسالة واتساب وحدة وبس."],
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <Reveal><div className="eyebrow text-forest">Mile 03 · how it works</div></Reveal>
      <div className="relative mt-10 grid gap-6 md:grid-cols-3">
        <div className="dash-line absolute inset-x-8 top-[46px] hidden h-[6px] opacity-80 md:block" />
        {steps.map(([n, t, d], i) => (
          <Reveal key={n} delay={i * 0.12} className="relative">
            <motion.div whileHover={{ y: -6, rotate: i === 1 ? 1 : -1 }} className="relative rounded-[18px] border-[3px] border-coal bg-[#FBF7EE] p-6 shadow-hard">
              <div className="sign-plate absolute -top-10 right-6 grid h-[76px] w-[76px] place-items-center font-sign text-4xl font-black">{n}</div>
              <h3 className="mt-10 font-display text-4xl">{t}</h3>
              <p className="mt-2 text-coal-soft">{d}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- match night ---------------- */

function MatchNight() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <Reveal>
        <div className="relative grid overflow-hidden rounded-[22px] border-[3px] border-coal bg-tail text-paper shadow-hard md:grid-cols-2">
          <div className="relative z-10 p-8 md:p-14">
            <div className="eyebrow text-paper/80">Game night</div>
            <h2 className="mt-3 font-display text-6xl leading-[.95] md:text-8xl">في ماتش<br />الليلة؟</h2>
            <p className="mt-5 max-w-sm text-paper/85">عنا شاشة كبيرة والطاولات بتخلص قبل الماتش بساعات. احجز هلق واختار مكان بيطل عالشاشة.</p>
            <Link href="/book" className="pbtn mt-8 border-coal bg-paper text-coal shadow-hard">احجز للماتش <Arrow className="h-4 w-4" /></Link>
          </div>
          <div className="relative min-h-[320px]">
            <img src="/img/terrace_tables.jpg" alt="Route 66" className="absolute inset-0 h-full w-full object-cover object-[50%_70%] grayscale contrast-125 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-tail" />
          </div>
        </div>
      </Reveal>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {["/img/storefront_sign.jpg", "/img/table_breakfast.jpg", "/menu/starters__route-66-station-mix.jpg"].map((src, i) => (
          <Reveal key={src} delay={i * 0.08} className={i === 2 ? "hidden md:block" : ""}>
            <motion.div whileHover={{ rotate: i % 2 ? 1.5 : -1.5, scale: 1.02 }} className="overflow-hidden rounded-[18px] border-[3px] border-coal shadow-hard-sm">
              <img src={src} alt="" className="aspect-[4/5] w-full object-cover object-bottom" loading="lazy" />
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
