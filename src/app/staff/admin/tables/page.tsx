"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Field, Spinner, useToast } from "@/components/ui";

type Zone = { id: string; tempId?: string; name: string; sort: number; width: number; height: number };
type T = { id?: string; key: string; zoneId: string; label: string; seats: number; shape: "ROUND" | "RECT"; x: number; y: number; w: number; h: number; rotation: number; bookable: boolean };

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;

export default function TablesEditor() {
  const toast = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<T[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ key: string; dx: number; dy: number } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ zones: Zone[]; tables: (Omit<T, "key"> & { id: string })[] }>("/api/admin/floor");
    setZones(r.zones);
    setTables(r.tables.map((t) => ({ ...t, key: t.id })));
    setZone((z) => z ?? r.zones[0]?.id ?? null);
    setLoaded(true);
    setDirty(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const z = zones.find((x) => (x.id || x.tempId) === zone);
  const zt = tables.filter((t) => t.zoneId === zone);
  const s = tables.find((t) => t.key === sel);
  const upd = (key: string, p: Partial<T>) => { setTables((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t))); setDirty(true); };

  const pt = (e: React.PointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const onDown = (e: React.PointerEvent, t: T) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = pt(e);
    drag.current = { key: t.key, dx: p.x - t.x, dy: p.y - t.y };
    setSel(t.key);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !z) return;
    const p = pt(e);
    const t = tables.find((x) => x.key === drag.current!.key)!;
    upd(t.key, { x: Math.max(0, Math.min(z.width - t.w, snap(p.x - drag.current.dx))), y: Math.max(0, Math.min(z.height - t.h, snap(p.y - drag.current.dy))) });
  };
  const onUp = () => { drag.current = null; };

  const nextLabel = () => {
    const nums = tables.map((t) => parseInt(t.label.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const prefix = z && zones.indexOf(z) > 0 ? (z.name.trim()[0] === "ا" ? "T" : z.name.trim()[0]) : "";
    return `${prefix}${(nums.length ? Math.max(...nums) : 0) + 1}`;
  };
  const addTable = (shape: "ROUND" | "RECT", seats: number) => {
    if (!zone) return;
    const key = `new-${Date.now()}`;
    const size = shape === "ROUND" ? { w: seats > 4 ? 120 : 80, h: seats > 4 ? 120 : 80 } : { w: seats >= 8 ? 200 : seats >= 6 ? 170 : 120, h: seats >= 6 ? 100 : 90 };
    setTables((ts) => [...ts, { key, zoneId: zone, label: nextLabel(), seats, shape, x: 40, y: 40, ...size, rotation: 0, bookable: true }]);
    setSel(key);
    setDirty(true);
  };
  const addZone = () => {
    const name = prompt("اسم القسم (مثلاً: الطابق التاني)");
    if (!name) return;
    const tempId = `z-${Date.now()}`;
    setZones((zs) => [...zs, { id: tempId, tempId, name, sort: zs.length, width: 1000, height: 640 }]);
    setZone(tempId);
    setDirty(true);
  };

  const save = async () => {
    try {
      await api("/api/admin/floor", {
        method: "PUT",
        body: {
          zones: zones.map((x, i) => ({ id: x.tempId ? undefined : x.id, tempId: x.tempId, name: x.name, sort: i, width: x.width, height: x.height })),
          tables: tables.map((t) => ({ id: t.id, zoneId: t.zoneId, label: t.label, seats: t.seats, shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation, bookable: t.bookable })),
        },
      });
      toast("انحفظت الخريطة");
      setZone(null);
      load();
    } catch (e) { toast((e as Error).message, "err"); }
  };

  if (!loaded) return <Spinner />;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl leading-none">خريطة الطاولات</h1>
        <div className="flex gap-2">
          <a href="/staff/admin/qr" className="btn-ghost">رموز QR</a>
          <button className="btn-neon" disabled={!dirty} onClick={save}>حفظ الخريطة</button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {zones.map((x) => <button key={x.id} onClick={() => { setZone(x.id); setSel(null); }} className={`tab ${zone === x.id ? "tab-active" : ""}`}>{x.name}</button>)}
        <button className="tab text-neon" onClick={addZone}>+ قسم</button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="card p-3">
          {z && (
            <svg ref={svg} viewBox={`-20 -20 ${z.width + 40} ${z.height + 40}`} className="h-auto w-full touch-none select-none" style={{ direction: "ltr" }}
              onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerDown={() => setSel(null)}>
              <defs><pattern id="g" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse"><path d={`M ${GRID * 4} 0 L 0 0 0 ${GRID * 4}`} fill="none" stroke="rgba(255,255,255,0.06)" /></pattern></defs>
              <rect x={0} y={0} width={z.width} height={z.height} rx={12} fill="#101a12" stroke="rgba(255,255,255,0.12)" />
              <rect x={0} y={0} width={z.width} height={z.height} fill="url(#g)" />
              {zt.map((t) => (
                <g key={t.key} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.w / 2} ${t.h / 2})`} onPointerDown={(e) => onDown(e, t)} style={{ cursor: "grab" }}>
                  {t.shape === "ROUND"
                    ? <ellipse cx={t.w / 2} cy={t.h / 2} rx={t.w / 2} ry={t.h / 2} fill={t.bookable ? "#1d4a25" : "#2a2a2a"} stroke={sel === t.key ? "#F2C14E" : "#4f9a5e"} strokeWidth={sel === t.key ? 4 : 2} />
                    : <rect width={t.w} height={t.h} rx={12} fill={t.bookable ? "#1d4a25" : "#2a2a2a"} stroke={sel === t.key ? "#F2C14E" : "#4f9a5e"} strokeWidth={sel === t.key ? 4 : 2} />}
                  <text x={t.w / 2} y={t.h / 2 + 2} textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff" pointerEvents="none">{t.label}</text>
                  <text x={t.w / 2} y={t.h / 2 + 19} textAnchor="middle" fontSize="11" fill="#fff" opacity="0.6" pointerEvents="none">{t.seats}</text>
                </g>
              ))}
            </svg>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-ghost py-2 text-xs" onClick={() => addTable("ROUND", 2)}>+ مدورة 2</button>
            <button className="btn-ghost py-2 text-xs" onClick={() => addTable("ROUND", 4)}>+ مدورة 4</button>
            <button className="btn-ghost py-2 text-xs" onClick={() => addTable("RECT", 4)}>+ مربعة 4</button>
            <button className="btn-ghost py-2 text-xs" onClick={() => addTable("RECT", 6)}>+ طويلة 6</button>
            <button className="btn-ghost py-2 text-xs" onClick={() => addTable("RECT", 8)}>+ عائلية 8</button>
          </div>
          <p className="mt-2 text-[11px] text-white/40">اسحب الطاولات لمكانها. صوّر المحل وارسم نفس التوزيع هون، هيك الزبون بيشوف المحل متل ما هو.</p>
        </div>

        <div className="card h-fit p-4">
          {z && !s && (
            <div className="space-y-3">
              <div className="font-semibold">القسم</div>
              <Field label="الاسم"><input className="input" value={z.name} onChange={(e) => { setZones((zs) => zs.map((x) => (x.id === z.id ? { ...x, name: e.target.value } : x))); setDirty(true); }} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="العرض"><input className="input num" type="number" value={z.width} onChange={(e) => { setZones((zs) => zs.map((x) => (x.id === z.id ? { ...x, width: Number(e.target.value) || 1000 } : x))); setDirty(true); }} /></Field>
                <Field label="الطول"><input className="input num" type="number" value={z.height} onChange={(e) => { setZones((zs) => zs.map((x) => (x.id === z.id ? { ...x, height: Number(e.target.value) || 640 } : x))); setDirty(true); }} /></Field>
              </div>
              {zones.length > 1 && <button className="btn-ghost w-full text-red-300" onClick={() => { setTables((ts) => ts.filter((t) => t.zoneId !== z.id)); setZones((zs) => zs.filter((x) => x.id !== z.id)); setZone(zones.find((x) => x.id !== z.id)!.id); setDirty(true); }}>حذف القسم وطاولاته</button>}
              <p className="text-xs text-white/40">كبسة على طاولة لتعدّلها</p>
            </div>
          )}
          {s && (
            <div className="space-y-3">
              <div className="font-semibold">طاولة {s.label}</div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="الرقم"><input className="input" value={s.label} onChange={(e) => upd(s.key, { label: e.target.value })} /></Field>
                <Field label="الكراسي"><input className="input num" type="number" min={1} value={s.seats} onChange={(e) => upd(s.key, { seats: Number(e.target.value) || 1 })} /></Field>
                <Field label="العرض"><input className="input num" type="number" value={s.w} onChange={(e) => upd(s.key, { w: Number(e.target.value) || 60 })} /></Field>
                <Field label="الطول"><input className="input num" type="number" value={s.h} onChange={(e) => upd(s.key, { h: Number(e.target.value) || 60 })} /></Field>
              </div>
              <div className="flex gap-1">
                <button className={`tab flex-1 ${s.shape === "ROUND" ? "tab-active" : ""}`} onClick={() => upd(s.key, { shape: "ROUND" })}>مدورة</button>
                <button className={`tab flex-1 ${s.shape === "RECT" ? "tab-active" : ""}`} onClick={() => upd(s.key, { shape: "RECT" })}>مربعة</button>
              </div>
              <Field label={`الدوران ${s.rotation}°`}><input type="range" min={0} max={345} step={15} value={s.rotation} onChange={(e) => upd(s.key, { rotation: Number(e.target.value) })} className="w-full" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.bookable} onChange={(e) => upd(s.key, { bookable: e.target.checked })} /> بتنحجز أونلاين</label>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => { const key = `new-${Date.now()}`; setTables((ts) => [...ts, { ...s, id: undefined, key, label: nextLabel(), x: s.x + 30, y: s.y + 30 }]); setSel(key); setDirty(true); }}>نسخ</button>
                <button className="btn-ghost flex-1 text-red-300" onClick={() => { setTables((ts) => ts.filter((t) => t.key !== s.key)); setSel(null); setDirty(true); }}>حذف</button>
              </div>
              {s.id && <a href="/staff/admin/qr" className="btn-ghost w-full text-xs">QR هالطاولة ←</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
