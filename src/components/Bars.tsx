"use client";
import { motion } from "motion/react";

/** bar chart that grows in; the last bar (today) is highlighted */
export function Bars({ data, label, value, height = 170, color = "#2f8a4f", fmt = (n: number) => n.toLocaleString("en-US"), highlightLast = true }: {
  data: { k: string; v: number }[]; label?: (k: string) => string; value?: boolean; height?: number; color?: string; fmt?: (n: number) => string; highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="relative" dir="ltr">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-dashed border-white/[.06]" />)}
      </div>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const last = highlightLast && i === data.length - 1;
          return (
            <div key={d.k} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
              <motion.div className="rounded-t-[4px]" style={{ background: last ? "#F5C518" : color, minHeight: d.v > 0 ? 3 : 0 }}
                initial={{ height: 0 }} animate={{ height: `${(d.v / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.035, ease: [0.22, 1, 0.36, 1] }} />
              <div className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 font-sign text-[11px] font-black group-hover:block">{fmt(d.v)}</div>
              {value && <div className="mt-1 text-center font-sign text-[9px] text-white/60">{fmt(d.v)}</div>}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => <div key={d.k} className={`min-w-0 flex-1 truncate text-center font-sign text-[10px] ${highlightLast && i === data.length - 1 ? "font-black text-line" : "text-white/35"}`}>{label ? label(d.k) : d.k}</div>)}
      </div>
    </div>
  );
}

export function HBar({ rows, fmt = (n: number) => n.toLocaleString("en-US") }: { rows: { name: string; v: number; sub?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.name}>
          <div className="mb-1 flex justify-between text-xs"><span>{r.name}{r.sub && <span className="text-white/40"> · {r.sub}</span>}</span><span className="num text-white/70">{fmt(r.v)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[.05]">
            <motion.div className="h-2 rounded-full bg-gradient-to-l from-[#2f8a4f] to-[#4fbf6c]" initial={{ width: 0 }} animate={{ width: `${(r.v / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
