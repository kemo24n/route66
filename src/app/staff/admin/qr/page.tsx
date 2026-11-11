"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/client";
import { qrDataUrl, downloadTableCard } from "@/lib/qrcard";
import { Spinner, useToast } from "@/components/ui";

type Row = { id: string; label: string; seats: number; zone: string; token: string; path: string };
type Res = { base: string; saved: string | null; local: boolean; tables: Row[] };

function isLocal(base: string) {
  try {
    const h = new URL(base).hostname;
    return h === "localhost" || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith(".local");
  } catch { return true; }
}

export default function QrStudio() {
  const toast = useToast();
  const [d, setD] = useState<Res | null>(null);
  const [addr, setAddr] = useState("");
  const [editing, setEditing] = useState(false);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<Res>("/api/admin/qr-tables");
    // if nothing is saved, the browser's own address is the most reliable one
    const base = r.saved || window.location.origin;
    setD({ ...r, base, local: isLocal(base) });
    setAddr(base);
    setSel((s) => s ?? r.tables[0]?.id ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const url = useCallback((t: Row) => `${d?.base}${t.path}`, [d?.base]);

  useEffect(() => {
    if (!d) return;
    let alive = true;
    Promise.all(d.tables.map(async (t) => [t.id, await qrDataUrl(url(t), 420)] as const)).then((list) => alive && setQrs(Object.fromEntries(list)));
    return () => { alive = false; };
  }, [d, url]);

  const saveAddr = async () => {
    const v = addr.trim().replace(/\/+$/, "");
    try {
      await api("/api/admin/settings", { method: "PATCH", body: { publicUrl: v === window.location.origin ? "" : v } });
      toast("انحفظ العنوان. اطبع الكروت من جديد إذا تغير");
      setEditing(false);
      load();
    } catch (e) { toast((e as Error).message, "err"); }
  };

  const rotate = async (t: Row) => {
    if (!confirm(`كود جديد لطاولة ${t.label}؟ الكرت المطبوع القديم بيوقف يشتغل.`)) return;
    setBusy(t.id);
    try {
      await api("/api/admin/qr-tables", { body: { tableId: t.id } });
      toast(`طاولة ${t.label}: كود جديد. اطبع كرتها من جديد`);
      await load();
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(null); }
  };

  const copy = async (t: Row) => {
    try { await navigator.clipboard.writeText(url(t)); toast("انسخ الرابط"); } catch { prompt("انسخ الرابط", url(t)); }
  };

  const download = async (t: Row) => {
    setBusy(t.id);
    try { await downloadTableCard(t.label, t.zone, url(t)); } finally { setBusy(null); }
  };

  const downloadAll = async () => {
    if (!d) return;
    setBusy("all");
    for (const t of d.tables) {
      await downloadTableCard(t.label, t.zone, url(t));
      await new Promise((r) => setTimeout(r, 350));
    }
    setBusy(null);
  };

  const current = useMemo(() => d?.tables.find((t) => t.id === sel) ?? null, [d, sel]);

  if (!d) return <div className="py-20 text-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none">رموز QR للطاولات</h1>
          <p className="text-sm text-white/50">كل طاولة إلها كود خاص. الزبون بيمسحه وبيفتح المنيو ونداء الويتر والحساب على هالطاولة بالذات.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={downloadAll} disabled={busy === "all"}>{busy === "all" ? <Spinner /> : "نزّل كل الكروت (PNG)"}</button>
          <a className="btn-neon" href="/staff/print/qr" target="_blank">طباعة كل الكروت</a>
        </div>
      </div>

      {/* address check: the #1 reason QR codes "don't work" */}
      <div className={`card overflow-hidden ${d.local ? "border-tail/60" : "border-forest-sign/60"}`}>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl ${d.local ? "bg-tail text-white" : "bg-forest-sign text-white"}`}>{d.local ? "!" : "✓"}</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-white/50">العنوان يلي جوّا الكودات</div>
            {editing ? (
              <input className="input mt-1 font-sign" dir="ltr" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="https://route66.example.com" autoFocus />
            ) : (
              <div className="truncate font-sign text-lg font-extrabold" dir="ltr">{d.base}</div>
            )}
            <div className={`mt-1 text-xs ${d.local ? "text-red-300" : "text-white/50"}`}>
              {d.local
                ? "هاد عنوان داخلي. الموبايلات برا هالجهاز أو هالشبكة ما رح تفتحه، وهيك الكود ما بيشتغل. افتح لوحة التحكم من عنوان الموقع الحقيقي، أو اكتبه هون."
                : d.saved ? "عنوان محفوظ يدوياً." : "مأخوذ من العنوان يلي فاتح عليه لوحة التحكم هلق."}
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2"><button className="btn-primary" onClick={saveAddr}>حفظ</button><button className="btn-ghost" onClick={() => { setEditing(false); setAddr(d.base); }}>إلغاء</button></div>
          ) : <button className="btn-ghost" onClick={() => setEditing(true)}>تغيير العنوان</button>}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* big preview of the selected table, scan it with your phone to test */}
        {current && (
          <div className="card h-fit p-5 xl:sticky xl:top-4">
            <div className="text-xs text-white/50">جرّب: امسح الكود بموبايلك</div>
            <AnimatePresence mode="wait">
              <motion.div key={current.id + current.token} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.35 }}
                className="mx-auto mt-3 overflow-hidden rounded-2xl border-4 border-[#15170F] bg-[#F3ECDD] text-[#15170F]" style={{ transformPerspective: 800 }}>
                <div className="flex items-center justify-between bg-[#0E4A23] px-4 py-3 text-[#F3ECDD]">
                  <img src="/img/logo.svg" alt="" className="h-9 w-9" />
                  <span className="font-sign text-sm font-black">ROUTE 66</span>
                </div>
                <div className="px-5 pb-5 pt-3 text-center">
                  <div className="font-display text-5xl leading-tight">طاولة {current.label}</div>
                  <div className="text-xs opacity-70">{current.zone}</div>
                  {qrs[current.id] ? <img src={qrs[current.id]} alt="" className="mx-auto mt-3 w-full max-w-[260px] rounded-xl border-4 border-[#15170F] bg-white" /> : <div className="mx-auto mt-3 aspect-square w-full max-w-[260px] animate-pulse rounded-xl bg-black/10" />}
                  <div className="mt-3 text-[13px] font-semibold">امسح الكود: المنيو · نادي الويتر · الحساب</div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-4 break-all rounded-lg bg-road px-3 py-2 font-sign text-xs text-white/70" dir="ltr">{url(current)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={url(current)} target="_blank" rel="noreferrer" className="btn-primary">افتحه كزبون</a>
              <button className="btn-ghost" onClick={() => copy(current)}>نسخ الرابط</button>
              <button className="btn-ghost" onClick={() => download(current)} disabled={busy === current.id}>نزّل الكرت</button>
              <button className="btn-ghost text-red-300" onClick={() => rotate(current)} disabled={busy === current.id}>كود جديد</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {d.tables.map((t, i) => (
            <motion.button key={t.id} onClick={() => setSel(t.id)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -4 }}
              className={`card p-3 text-right transition ${sel === t.id ? "border-line shadow-[0_0_0_2px_#F5C518]" : "hover:border-white/25"}`}>
              <div className="flex items-center justify-between">
                <span className="font-sign text-2xl font-black">{t.label}</span>
                <span className="text-[11px] text-white/45">{t.seats} كراسي · {t.zone}</span>
              </div>
              <div className="mt-2 overflow-hidden rounded-lg bg-white p-1.5">
                {qrs[t.id] ? <img src={qrs[t.id]} alt={`QR طاولة ${t.label}`} className="w-full" /> : <div className="aspect-square animate-pulse bg-black/10" />}
              </div>
              <div className="mt-2 truncate font-sign text-[10px] text-white/40" dir="ltr">{t.path}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
