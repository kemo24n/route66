"use client";
import { useEffect, useRef, useState } from "react";

export type MenuCat = { id: string; key: string; nameAr: string; nameEn: string; items: MenuItemLite[] };
export type MenuItemLite = { id: string; key: string; nameAr: string; nameEn: string; descAr: string; price: number; image: string | null; available: boolean };

/** category tabs that follow the scroll + item cards. `onAdd` turns it into an ordering menu. */
export function MenuBrowser({ categories, currency, onAdd, qtyOf, compact }: {
  categories: MenuCat[]; currency: string; onAdd?: (i: MenuItemLite) => void; qtyOf?: (id: string) => number; compact?: boolean;
}) {
  const [active, setActive] = useState<string | undefined>(categories[0]?.key);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.getAttribute("data-key") || undefined);
    }, { rootMargin: "-120px 0px -60% 0px" });
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [categories]);

  const go = (k: string) => {
    const el = refs.current[k];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
  };

  return (
    <div>
      <div className={`sticky z-30 -mx-4 mt-4 border-b border-white/5 bg-ink-900/90 px-4 py-2 backdrop-blur ${compact ? "top-0" : "top-[65px]"}`}>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button key={c.key} onClick={() => go(c.key)} className={`tab shrink-0 ${active === c.key ? "tab-active" : ""}`}>{c.nameAr}</button>
          ))}
        </div>
      </div>
      {categories.map((c) => (
        <section key={c.key} data-key={c.key} ref={(el) => { refs.current[c.key] = el; }} className="pt-6">
          <h2 className="mb-3 flex items-baseline gap-2 text-xl font-bold">{c.nameAr}<span className="text-xs font-normal text-white/40">{c.nameEn}</span></h2>
          <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {c.items.map((i) => {
              const q = qtyOf?.(i.id) ?? 0;
              return (
                <div key={i.id} id={i.key} className={`card flex gap-3 overflow-hidden p-2.5 ${!i.available ? "opacity-50" : ""}`}>
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-700">
                    {i.image ? <img src={i.image} alt={i.nameAr} className="h-full w-full object-cover object-[50%_72%]" loading="lazy" /> : <div className="flex h-full items-center justify-center text-2xl text-white/20">66</div>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="font-semibold">{i.nameAr}</div>
                    <div className="text-[11px] text-white/40">{i.nameEn}</div>
                    {i.descAr && <div className="mt-1 line-clamp-2 text-xs text-white/55">{i.descAr}</div>}
                    <div className="mt-auto flex items-center justify-between pt-1.5">
                      <span className="text-sm font-bold text-neon"><span className="num">{i.price.toLocaleString("en-US")}</span> <span className="text-[10px] text-white/50">{currency}</span></span>
                      {onAdd && i.available && (
                        <button onClick={() => onAdd(i)} className="btn-primary px-3 py-1.5 text-xs">{q > 0 ? `أضف (${q})` : "أضف"}</button>
                      )}
                      {!i.available && <span className="text-[11px] text-white/40">مو متوفر هلق</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
