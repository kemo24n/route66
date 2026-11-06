"use client";

/** tiny dependency-free bar chart */
export function Bars({ data, label, value, height = 160, color = "#4f9a5e", fmt = (n: number) => n.toLocaleString("en-US") }: {
  data: { k: string; v: number }[]; label?: (k: string) => string; value?: boolean; height?: number; color?: string; fmt?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="flex items-end gap-1" style={{ height }} dir="ltr">
      {data.map((d) => (
        <div key={d.k} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
          <div className="rounded-t-md transition-all group-hover:brightness-125" style={{ height: `${(d.v / max) * 100}%`, minHeight: d.v > 0 ? 3 : 0, background: color }} />
          <div className="mt-1 truncate text-center text-[9px] text-white/40">{label ? label(d.k) : d.k}</div>
          <div className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] group-hover:block">{fmt(d.v)}</div>
          {value && <div className="text-center text-[9px] text-white/60">{fmt(d.v)}</div>}
        </div>
      ))}
    </div>
  );
}

export function HBar({ rows, fmt = (n: number) => n.toLocaleString("en-US") }: { rows: { name: string; v: number; sub?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-0.5 flex justify-between text-xs"><span>{r.name}{r.sub && <span className="text-white/40"> · {r.sub}</span>}</span><span className="num text-white/70">{fmt(r.v)}</span></div>
          <div className="h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-brand-400" style={{ width: `${(r.v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
