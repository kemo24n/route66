"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

export type MenuCat = { id: string; key: string; nameAr: string; nameEn: string; items: MenuItemLite[] };
export type MenuItemLite = { id: string; key: string; nameAr: string; nameEn: string; descAr: string; price: number; image: string | null; available: boolean };

/**
 * Diner-style menu: sticky category rail, rows with dotted leaders, a photo that follows the
 * cursor on desktop, and a detail sheet with a shared-element photo on tap.
 * Pass onAdd to turn it into an ordering menu (table QR page).
 */
export function MenuList({ categories, currency, onAdd, qtyOf, topOffset = 72, dense }: {
  categories: MenuCat[]; currency: string; onAdd?: (i: MenuItemLite, from?: DOMRect) => void; qtyOf?: (id: string) => number; topOffset?: number; dense?: boolean;
}) {
  const [active, setActive] = useState<string | undefined>(categories[0]?.key);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<MenuItemLite | null>(null);
  const [hover, setHover] = useState<MenuItemLite | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const rail = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return categories;
    return categories.map((c) => ({ ...c, items: c.items.filter((i) => i.nameAr.includes(q.trim()) || i.nameEn.toLowerCase().includes(s)) })).filter((c) => c.items.length);
  }, [categories, q]);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.getAttribute("data-key") || undefined);
    }, { rootMargin: `-${topOffset + 70}px 0px -55% 0px` });
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [filtered, topOffset]);

  // keep the active tab visible in the rail
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const go = (k: string) => {
    const el = refs.current[k];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - topOffset - 64, behavior: "smooth" });
  };

  return (
    <LayoutGroup>
      <div onPointerMove={(e) => setPos({ x: e.clientX, y: e.clientY })}>
        <div className="sticky z-30 -mx-4 border-y-2 border-coal bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6" style={{ top: topOffset }}>
          <div className="flex items-center gap-3">
            <div ref={rail} className="scrollbar-none flex flex-1 gap-1.5 overflow-x-auto">
              {filtered.map((c) => (
                <button key={c.key} data-tab={c.key} onClick={() => go(c.key)} className="relative shrink-0 rounded-lg px-4 py-2 text-[15px] font-semibold">
                  {active === c.key && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-lg bg-forest shadow-[inset_0_0_0_2px_#0E4A23,inset_0_0_0_4px_#F3ECDD]" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span className={`relative ${active === c.key ? "text-paper" : ""}`}>{c.nameAr}</span>
                </button>
              ))}
            </div>
            {!dense && (
              <label className="relative hidden sm:block">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شو نفسك؟" className="w-48 rounded-lg border-2 border-coal/70 bg-[#FBF7EE] py-2 pl-3 pr-9 text-sm outline-none focus:border-forest" />
                <svg viewBox="0 0 24 24" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </label>
            )}
          </div>
        </div>

        {filtered.length === 0 && <div className="py-20 text-center text-coal-mute">ما لقينا شي بهالاسم</div>}

        {filtered.map((c, ci) => (
          <section key={c.key} data-key={c.key} ref={(el) => { refs.current[c.key] = el; }} className={dense ? "pt-8" : "pt-14"}>
            <div className="mb-4 flex items-end justify-between gap-4 border-b-[3px] border-coal pb-3">
              <h2 className={`font-display leading-none ${dense ? "text-4xl" : "text-5xl md:text-6xl"}`}>{c.nameAr}</h2>
              <div className="flex items-center gap-3 pb-1">
                <span className="eyebrow text-coal-mute">{c.nameEn}</span>
                <span className="num rounded-md bg-coal px-2 py-0.5 font-sign text-xs font-black text-paper">{String(ci + 1).padStart(2, "0")}</span>
              </div>
            </div>
            <ul className={`grid grid-cols-[minmax(0,1fr)] ${dense ? "gap-2" : "gap-x-12 md:grid-cols-[repeat(2,minmax(0,1fr))]"}`}>
              {c.items.map((i) => {
                const qty = qtyOf?.(i.id) ?? 0;
                return (
                  <li key={i.id} id={i.key} className={`${dense ? "" : "border-b-2 border-dashed border-coal/15"}`}>
                    <div className={`group flex w-full items-center gap-3 py-3 text-right ${!i.available ? "opacity-45" : ""} ${dense ? "rounded-xl border-2 border-coal bg-[#FBF7EE] p-2 shadow-hard-sm" : ""}`}>
                      <button className="flex min-w-0 flex-1 items-center gap-3 text-right" onClick={() => setOpen(i)} onPointerEnter={() => !dense && setHover(i)} onPointerLeave={() => setHover(null)}>
                        <motion.div layoutId={`ph-${i.id}`} className={`shrink-0 overflow-hidden rounded-[10px] border-2 border-coal bg-coal ${dense ? "h-20 w-20" : "h-16 w-16"}`}>
                          {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover object-[50%_78%]" loading="lazy" /> : <div className="grid h-full place-items-center font-sign font-black text-paper/40">66</div>}
                        </motion.div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[17px] font-semibold transition-colors group-hover:text-forest">{i.nameAr}</span>
                          <span className="block truncate font-sign text-[10px] font-extrabold uppercase tracking-[.16em] text-coal-mute">{i.nameEn}</span>
                          {i.descAr && <span className="mt-0.5 line-clamp-1 block text-xs text-coal-soft">{i.descAr}</span>}
                        </span>
                        {!dense && <span className="leader hidden lg:block" />}
                        <span className="whitespace-nowrap font-sign text-lg font-black"><span className="num">{i.price.toLocaleString("en-US")}</span> <span className="text-[10px] font-semibold text-coal-mute">{currency}</span></span>
                      </button>
                      {onAdd && i.available && (
                        <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => onAdd(i, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border-2 border-coal text-xl font-black shadow-hard-sm ${qty ? "bg-forest text-paper" : "bg-line"}`} aria-label={`أضف ${i.nameAr}`}>
                          {qty ? <span className="num text-base">{qty}</span> : "+"}
                        </motion.button>
                      )}
                      {!i.available && <span className="shrink-0 rounded-md bg-coal/10 px-2 py-1 text-[11px]">خلص</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <AnimatePresence>
        {hover?.image && !open && (
          <motion.img key={hover.id} src={hover.image} alt="" className="pointer-events-none fixed z-[60] hidden h-60 w-48 rounded-2xl border-[3px] border-coal object-cover object-[50%_80%] shadow-lift md:block"
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: -4, left: pos.x + 22, top: pos.y - 120 }} exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.6 }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-coal/60 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <motion.div className="relative w-full overflow-hidden rounded-t-[24px] border-[3px] border-coal bg-paper sm:max-w-md sm:rounded-[24px] sm:shadow-hard" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} onClick={(e) => e.stopPropagation()}>
              <motion.div layoutId={`ph-${open.id}`} className="aspect-[4/4] w-full overflow-hidden bg-coal">
                {open.image && <img src={open.image} alt={open.nameAr} className="h-full w-full object-cover object-[50%_75%]" />}
              </motion.div>
              <button onClick={() => setOpen(null)} className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full border-2 border-coal bg-paper text-lg" aria-label="إغلاق">✕</button>
              <div className="p-6">
                <div className="eyebrow text-coal-mute">{open.nameEn}</div>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <h3 className="font-display text-4xl leading-none">{open.nameAr}</h3>
                  <div className="whitespace-nowrap font-sign text-2xl font-black"><span className="num">{open.price.toLocaleString("en-US")}</span> <span className="text-xs text-coal-mute">{currency}</span></div>
                </div>
                {open.descAr && <p className="mt-3 text-coal-soft">{open.descAr}</p>}
                {onAdd && open.available && (
                  <button className="pbtn-go mt-6 w-full py-4 text-lg" onClick={(e) => { onAdd(open, (e.currentTarget as HTMLElement).getBoundingClientRect()); setOpen(null); }}>
                    أضف للطلب
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
