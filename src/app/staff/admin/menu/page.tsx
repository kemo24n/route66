"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Field, Modal, Money, Spinner, useToast } from "@/components/ui";

type Cat = { id: string; key: string; nameAr: string; nameEn: string };
type Item = { id: string; categoryId: string; nameAr: string; nameEn: string; descAr: string; price: number; image: string | null; available: boolean; station: "KITCHEN" | "BAR"; sort: number };

export default function MenuAdmin() {
  const toast = useToast();
  const [d, setD] = useState<{ categories: Cat[]; items: Item[] } | null>(null);
  const [usd, setUsd] = useState(110);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Item> & { imageData?: string } | null>(null);
  const [bulk, setBulk] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const load = useCallback(() => api<{ categories: Cat[]; items: Item[] }>("/api/admin/menu").then((r) => { setD(r); setPrices({}); }), []);
  useEffect(() => { load(); api<{ usdRate: number }>("/api/admin/settings").then((s) => setUsd(s.usdRate)).catch(() => {}); }, [load]);

  const list = useMemo(() => (d?.items ?? []).filter((i) => (cat === "all" || i.categoryId === cat) && (!q || i.nameAr.includes(q) || i.nameEn.toLowerCase().includes(q.toLowerCase()))), [d, cat, q]);
  const dirty = Object.keys(prices).filter((id) => Number(prices[id]) !== d?.items.find((i) => i.id === id)?.price && prices[id] !== "");

  const saveInline = async () => {
    try {
      for (const id of dirty) await api(`/api/admin/menu/${id}`, { method: "PATCH", body: { price: Number(prices[id]) } });
      toast(`انحفظ ${dirty.length} سعر`);
      load();
    } catch (e) { toast((e as Error).message, "err"); }
  };
  const toggle = async (i: Item) => {
    await api(`/api/admin/menu/${i.id}`, { method: "PATCH", body: { available: !i.available } });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl leading-none">المنيو والأسعار</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setBulk(true)}>رفع / تنزيل الأسعار بنسبة</button>
          <button className="btn-neon" onClick={() => setEdit({ categoryId: d?.categories[0]?.id, station: "KITCHEN", price: 0, available: true, nameAr: "", nameEn: "", descAr: "" })}>+ صنف جديد</button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          <button onClick={() => setCat("all")} className={`tab ${cat === "all" ? "tab-active" : ""}`}>الكل</button>
          {d?.categories.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`tab shrink-0 ${cat === c.id ? "tab-active" : ""}`}>{c.nameAr}</button>)}
        </div>
        <input className="input max-w-xs py-2" placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!d ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-white/50"><tr className="border-b border-white/5"><th className="p-2" /><th className="p-2 text-right">الصنف</th><th className="p-2 text-right">السعر (ليرة)</th><th className="p-2 text-right">بالدولار</th><th className="p-2 text-right">متوفر</th><th className="p-2" /></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className={`border-b border-white/5 last:border-0 ${!i.available ? "opacity-50" : ""}`}>
                  <td className="w-14 p-2"><div className="h-11 w-11 overflow-hidden rounded-lg bg-ink-700">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div></td>
                  <td className="p-2"><div className="font-semibold">{i.nameAr}</div><div className="text-[11px] text-white/40">{i.nameEn} · {i.station === "BAR" ? "بار" : "مطبخ"}</div></td>
                  <td className="p-2"><input className={`input num w-28 py-1.5 ${dirty.includes(i.id) ? "border-neon" : ""}`} inputMode="numeric" value={prices[i.id] ?? String(i.price)} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value.replace(/\D/g, "") })} /></td>
                  <td className="num p-2 text-xs text-white/50">${((Number(prices[i.id] ?? i.price) || 0) / usd).toFixed(2)}</td>
                  <td className="p-2"><button onClick={() => toggle(i)} className={`chip ${i.available ? "bg-brand-400/20 text-brand-200" : "bg-red-500/15 text-red-300"}`}>{i.available ? "متوفر" : "مخلص"}</button></td>
                  <td className="p-2"><button className="text-xs text-neon hover:underline" onClick={() => setEdit(i)}>تعديل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dirty.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center">
          <div className="card flex items-center gap-3 px-4 py-3 shadow-2xl">
            <span className="text-sm">{dirty.length} سعر متغير</span>
            <button className="btn-ghost py-2" onClick={() => setPrices({})}>تراجع</button>
            <button className="btn-neon py-2" onClick={saveInline}>حفظ الأسعار</button>
          </div>
        </div>
      )}
      {edit && d && <EditItem item={edit} cats={d.categories} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {bulk && d && <BulkPrice cats={d.categories} onClose={() => setBulk(false)} onDone={() => { setBulk(false); load(); }} />}
    </div>
  );
}

function EditItem({ item, cats, onClose, onSaved }: { item: Partial<Item> & { imageData?: string }; cats: Cat[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(item);
  const [hist, setHist] = useState<{ oldPrice: number; newPrice: number; createdAt: string }[]>([]);
  useEffect(() => { if (item.id) api<{ history: typeof hist }>(`/api/admin/menu/${item.id}`).then((r) => setHist(r.history)); }, [item.id]);
  const pickImage = (file?: File) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      const s = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = img.width * s; c.height = img.height * s;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setF((x) => ({ ...x, imageData: c.toDataURL("image/jpeg", 0.82), image: c.toDataURL("image/jpeg", 0.5) }));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  const save = async () => {
    try {
      const body = { categoryId: f.categoryId, nameAr: f.nameAr, nameEn: f.nameEn ?? "", descAr: f.descAr ?? "", price: Number(f.price) || 0, station: f.station, ...(f.id ? { available: f.available } : {}), ...(f.imageData ? { image: f.imageData } : {}) };
      if (f.id) await api(`/api/admin/menu/${f.id}`, { method: "PATCH", body });
      else await api("/api/admin/menu", { body });
      toast("انحفظ");
      onSaved();
    } catch (e) { toast((e as Error).message, "err"); }
  };
  const del = async () => {
    if (!f.id || !confirm("متأكد؟")) return;
    const r = await api<{ hidden?: boolean }>(`/api/admin/menu/${f.id}`, { method: "DELETE" });
    toast(r.hidden ? "الصنف إله مبيعات قديمة، فانخفى بدل ما ينحذف" : "انحذف");
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={f.id ? "تعديل صنف" : "صنف جديد"}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-20 w-20 overflow-hidden rounded-xl bg-ink-700">{f.image && <img src={f.image} alt="" className="h-full w-full object-cover" />}</div>
          <label className="btn-ghost cursor-pointer text-xs">تغيير الصورة<input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم بالعربي"><input className="input" value={f.nameAr ?? ""} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></Field>
          <Field label="الاسم بالإنكليزي"><input className="input" dir="ltr" value={f.nameEn ?? ""} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></Field>
          <Field label="القسم"><select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></Field>
          <Field label="السعر (ليرة)"><input className="input num" inputMode="numeric" value={String(f.price ?? "")} onChange={(e) => setF({ ...f, price: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
          <Field label="بيتحضّر بـ"><select className="input" value={f.station} onChange={(e) => setF({ ...f, station: e.target.value as "KITCHEN" })}><option value="KITCHEN">المطبخ</option><option value="BAR">البار</option></select></Field>
        </div>
        <Field label="الوصف"><input className="input" value={f.descAr ?? ""} onChange={(e) => setF({ ...f, descAr: e.target.value })} /></Field>
        {hist.length > 0 && (
          <div className="rounded-xl bg-white/5 p-3 text-xs">
            <div className="mb-1 text-white/50">تغييرات السعر</div>
            {hist.map((h, k) => <div key={k} className="flex justify-between"><span className="num text-white/50">{h.createdAt.slice(0, 10)}</span><span><Money v={h.oldPrice} /> ← <Money v={h.newPrice} /></span></div>)}
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-neon flex-1" onClick={save} disabled={!f.nameAr}>حفظ</button>
          {f.id && <button className="btn-ghost text-red-300" onClick={del}>حذف</button>}
        </div>
      </div>
    </Modal>
  );
}

function BulkPrice({ cats, onClose, onDone }: { cats: Cat[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [percent, setPercent] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [roundTo, setRoundTo] = useState("50");
  const [preview, setPreview] = useState<{ count: number; changes: { name: string; from: number; to: number }[] } | null>(null);
  const run = async (dryRun: boolean) => {
    try {
      const r = await api<NonNullable<typeof preview>>("/api/admin/menu/bulk", { body: { percent: Number(percent), categoryId: categoryId || undefined, roundTo: Number(roundTo) || 1, dryRun } });
      if (dryRun) setPreview(r);
      else { toast(`تعدّل ${r.count} سعر`); onDone(); }
    } catch (e) { toast((e as Error).message, "err"); }
  };
  return (
    <Modal open onClose={onClose} title="تعديل الأسعار بنسبة" wide>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="النسبة %" hint="مثلاً 15 رفع، -10 تنزيل"><input className="input num" value={percent} onChange={(e) => { setPercent(e.target.value); setPreview(null); }} /></Field>
        <Field label="القسم"><select className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPreview(null); }}><option value="">كل المنيو</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></Field>
        <Field label="تقريب لأقرب"><select className="input" value={roundTo} onChange={(e) => { setRoundTo(e.target.value); setPreview(null); }}>{["1", "10", "25", "50", "100"].map((r) => <option key={r}>{r}</option>)}</select></Field>
      </div>
      {preview && (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-xl bg-white/5 p-3 text-sm">
          {preview.changes.map((c) => <div key={c.name} className="flex justify-between py-0.5"><span>{c.name}</span><span><Money v={c.from} /> ← <b className="text-neon"><Money v={c.to} /></b></span></div>)}
          {preview.count === 0 && <div className="text-white/50">ما في تغيير</div>}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => run(true)}>معاينة</button>
        <button className="btn-neon flex-1" disabled={!preview || preview.count === 0} onClick={() => run(false)}>تطبيق على {preview?.count ?? 0} صنف</button>
      </div>
    </Modal>
  );
}
