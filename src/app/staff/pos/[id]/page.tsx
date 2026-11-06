"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useLive } from "@/lib/client";
import { Modal, Money, Spinner, useToast } from "@/components/ui";
import { useMe } from "@/components/MeContext";
import { computeTotals, PAY_LABELS } from "@/lib/money";
import type { MenuCat } from "@/components/MenuBrowser";

type Line = { id: string; menuItemId: string; nameAr: string; unitPrice: number; qty: number; notes: string | null; status: string; fromQr: boolean };
type OrderRes = {
  order: { id: string; number: number; type: string; status: string; guests: number; notes: string | null; discount: number; tableId: string | null; table: { label: string } | null; waiter: { name: string } | null; items: Line[]; subtotal: number };
  totals: { subtotal: number; discount: number; serviceCharge: number; tax: number; total: number };
  settings: { taxPercent: number; servicePercent: number; usdRate: number; currency: string };
  invoice: { id: string } | null;
};

const ST: Record<string, [string, string]> = {
  DRAFT: ["ما انبعت", "bg-white/10 text-white/70"], NEW: ["بالمطبخ", "bg-neon/15 text-neon"], PREPARING: ["عم ينطبخ", "bg-orange-500/15 text-orange-300"],
  READY: ["جاهز", "bg-brand-400/25 text-brand-100"], SERVED: ["انقدّم", "bg-white/5 text-white/40"], VOID: ["ملغى", "bg-red-500/10 text-red-300 line-through"],
};

export default function PosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const { data, reload } = useLive<OrderRes>(`/api/staff/orders/${id}`, ["kitchen", "floor"], 15000);
  const [menu, setMenu] = useState<MenuCat[] | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [noteFor, setNoteFor] = useState<Line | null>(null);
  const [note, setNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [voidFor, setVoidFor] = useState<Line | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ categories: MenuCat[] }>("/api/staff/menu").then((r) => { setMenu(r.categories); setCat(r.categories[0]?.key ?? null); }); }, []);

  const items = useMemo(() => {
    if (!menu) return [];
    if (q.trim()) return menu.flatMap((c) => c.items).filter((i) => i.nameAr.includes(q.trim()) || i.nameEn.toLowerCase().includes(q.trim().toLowerCase()));
    return menu.find((c) => c.key === cat)?.items ?? [];
  }, [menu, cat, q]);

  if (!data) return <div className="py-20 text-center"><Spinner /></div>;
  const o = data.order;
  const closed = o.status !== "OPEN";
  const drafts = o.items.filter((i) => i.status === "DRAFT");

  const call = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); await reload(); } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  const add = (menuItemId: string) => call(() => api(`/api/staff/orders/${id}/items`, { body: { menuItemId, qty: 1 } }));
  const setQty = (l: Line, qty: number) => qty < 1 ? call(() => api(`/api/staff/order-items/${l.id}`, { method: "DELETE" })) : call(() => api(`/api/staff/order-items/${l.id}`, { method: "PATCH", body: { qty } }));
  const send = () => call(() => api(`/api/staff/orders/${id}/send`, { method: "POST" }), "انبعت للمطبخ");
  const served = (l: Line) => call(() => api(`/api/staff/order-items/${l.id}`, { method: "PATCH", body: { status: "SERVED" } }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* menu */}
      <div className={`min-w-0 ${closed ? "pointer-events-none opacity-40" : ""}`}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => router.push("/staff/floor")} className="btn-ghost px-3">→ الصالة</button>
          <input className="input" placeholder="دوّر على صنف..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto">
          {menu?.map((c) => <button key={c.key} onClick={() => { setCat(c.key); setQ(""); }} className={`tab shrink-0 ${cat === c.key && !q ? "tab-active" : ""}`}>{c.nameAr}</button>)}
        </div>
        {!menu ? <Spinner /> : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((i) => (
              <button key={i.id} disabled={!i.available || busy} onClick={() => add(i.id)}
                className="card group overflow-hidden text-right transition hover:border-brand-300 disabled:opacity-40">
                <div className="aspect-[4/3] overflow-hidden bg-ink-700">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover object-[50%_72%]" loading="lazy" />}</div>
                <div className="p-2">
                  <div className="truncate text-sm font-semibold">{i.nameAr}</div>
                  <div className="text-xs text-neon"><Money v={i.price} cur={data.settings.currency} /></div>
                  {!i.available && <div className="text-[10px] text-red-300">مو متوفر</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ticket */}
      <div className="card flex h-fit flex-col lg:sticky lg:top-4">
        <div className="border-b border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">{o.type === "TAKEAWAY" ? "سفري" : `طاولة ${o.table?.label ?? ""}`} <span className="text-sm font-normal text-white/50">#{o.number}</span></div>
            {closed ? <span className="chip bg-white/10">{o.status === "PAID" ? "مدفوع" : "ملغى"}</span> : (
              <div className="flex items-center gap-1 text-xs text-white/60">
                <button className="btn-ghost h-7 w-7 p-0" onClick={() => call(() => api(`/api/staff/orders/${id}`, { method: "PATCH", body: { guests: Math.max(1, o.guests - 1) } }))}>−</button>
                <span className="num">{o.guests}</span> أشخاص
                <button className="btn-ghost h-7 w-7 p-0" onClick={() => call(() => api(`/api/staff/orders/${id}`, { method: "PATCH", body: { guests: o.guests + 1 } }))}>+</button>
              </div>
            )}
          </div>
          {o.waiter && <div className="text-xs text-white/40">{o.waiter.name}</div>}
        </div>

        <div className="max-h-[50vh] flex-1 divide-y divide-white/5 overflow-y-auto">
          {o.items.length === 0 && <div className="p-6 text-center text-sm text-white/40">اختار أصناف من المنيو</div>}
          {o.items.map((l) => {
            const [sl, sc] = ST[l.status];
            return (
              <div key={l.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${l.status === "VOID" ? "line-through opacity-50" : ""}`}>{l.nameAr}</div>
                    {l.notes && <div className="text-xs text-neon">{l.notes}</div>}
                    <div className="mt-1 flex items-center gap-1.5"><span className={`chip ${sc}`}>{sl}</span>{l.fromQr && <span className="chip bg-sky-500/15 text-sky-300">QR</span>}</div>
                  </div>
                  <div className="text-left text-sm"><Money v={l.unitPrice * l.qty} /></div>
                </div>
                {!closed && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {l.status === "DRAFT" ? (
                      <>
                        <button className="btn-ghost h-8 w-8 p-0" onClick={() => setQty(l, l.qty - 1)}>−</button>
                        <span className="num w-6 text-center">{l.qty}</span>
                        <button className="btn-ghost h-8 w-8 p-0" onClick={() => setQty(l, l.qty + 1)}>+</button>
                        <button className="btn-ghost h-8 px-2 text-xs" onClick={() => { setNoteFor(l); setNote(l.notes ?? ""); }}>ملاحظة</button>
                      </>
                    ) : (
                      <>
                        <span className="num text-xs text-white/50">×{l.qty}</span>
                        {l.status === "READY" && <button className="btn-primary h-8 px-3 text-xs" onClick={() => served(l)}>قدّمته</button>}
                        {l.status !== "VOID" && me?.perms.includes("void") && <button className="btn-ghost h-8 px-2 text-xs text-red-300" onClick={() => { setVoidFor(l); setVoidReason(""); }}>إلغاء</button>}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-white/5 p-4 text-sm">
          <Row k="المجموع" v={<Money v={data.totals.subtotal} />} />
          {data.totals.serviceCharge > 0 && <Row k={`خدمة ${data.settings.servicePercent}%`} v={<Money v={data.totals.serviceCharge} />} />}
          {data.totals.tax > 0 && <Row k={`ضريبة ${data.settings.taxPercent}%`} v={<Money v={data.totals.tax} />} />}
          <div className="flex justify-between pt-1 text-lg font-bold"><span>الإجمالي</span><Money v={data.totals.total} /></div>
          <div className="text-left text-xs text-white/40">≈ ${(data.totals.total / data.settings.usdRate).toFixed(2)}</div>
        </div>

        {!closed ? (
          <div className="grid gap-2 border-t border-white/5 p-4">
            <button onClick={send} disabled={busy || drafts.length === 0} className="btn-neon py-3 text-base">ابعت للمطبخ {drafts.length > 0 && `(${drafts.reduce((a, d) => a + d.qty, 0)})`}</button>
            <div className="flex gap-2">
              {me?.perms.includes("checkout") && <button onClick={() => setPayOpen(true)} disabled={busy || o.items.length === 0} className="btn-primary flex-1 py-3">الدفع</button>}
              <button onClick={() => setCancelOpen(true)} className="btn-ghost text-red-300">إلغاء الطلب</button>
            </div>
          </div>
        ) : data.invoice && (
          <div className="border-t border-white/5 p-4"><a href={`/staff/print/invoice/${data.invoice.id}`} target="_blank" className="btn-ghost w-full">طباعة الفاتورة</a></div>
        )}
      </div>

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`ملاحظة: ${noteFor?.nameAr ?? ""}`}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {["بدون بصل", "بدون مايونيز", "حار", "صوص زيادة", "بدون خضرة", "مستوى الشوي: ويل دن"].map((n) => (
            <button key={n} className="chip bg-white/10 py-1" onClick={() => setNote((x) => (x ? `${x}، ${n}` : n))}>{n}</button>
          ))}
        </div>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={150} autoFocus />
        <button className="btn-primary mt-3 w-full" onClick={() => { const l = noteFor!; setNoteFor(null); call(() => api(`/api/staff/order-items/${l.id}`, { method: "PATCH", body: { notes: note || null } })); }}>حفظ</button>
      </Modal>

      <Modal open={!!voidFor} onClose={() => setVoidFor(null)} title={`إلغاء ${voidFor?.nameAr ?? ""}`}>
        <p className="mb-2 text-sm text-white/60">الصنف انبعت للمطبخ. الإلغاء بيتسجل باسمك مع السبب.</p>
        <input className="input" placeholder="السبب: الزبون غيّر رأيه، غلط بالطلب..." value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        <button className="btn-danger mt-3 w-full" disabled={voidReason.trim().length < 2} onClick={() => { const l = voidFor!; setVoidFor(null); call(() => api(`/api/staff/order-items/${l.id}`, { method: "DELETE", body: { reason: voidReason } }), "انلغى الصنف"); }}>إلغاء الصنف</button>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="إلغاء الطلب كامل">
        <input className="input" placeholder="السبب" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        <button className="btn-danger mt-3 w-full" disabled={voidReason.trim().length < 2}
          onClick={() => call(async () => { await api(`/api/staff/orders/${id}/cancel`, { body: { reason: voidReason } }); router.push("/staff/floor"); }, "انلغى الطلب")}>تأكيد الإلغاء</button>
      </Modal>

      {payOpen && <PayModal data={data} onClose={() => setPayOpen(false)} onPaid={(invoiceId) => { setPayOpen(false); window.open(`/staff/print/invoice/${invoiceId}`, "_blank"); router.push("/staff/floor"); }} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between text-white/70"><span>{k}</span>{v}</div>;
}

type PayLine = { method: "CASH_SYP" | "CASH_USD" | "SHAM_CASH" | "CARD"; amount: string; reference?: string };

function PayModal({ data, onClose, onPaid }: { data: OrderRes; onClose: () => void; onPaid: (invoiceId: string) => void }) {
  const toast = useToast();
  const s = data.settings;
  const [discount, setDiscount] = useState(String(data.order.discount || ""));
  const totals = computeTotals(data.order.subtotal, Number(discount) || 0, s.servicePercent, s.taxPercent);
  const [lines, setLines] = useState<PayLine[]>([{ method: "CASH_SYP", amount: String(totals.total) }]);
  const [busy, setBusy] = useState(false);

  const toSyp = (l: PayLine) => (l.method === "CASH_USD" ? (Number(l.amount) || 0) * s.usdRate : Number(l.amount) || 0);
  const paid = lines.reduce((a, l) => a + toSyp(l), 0);
  const diff = Math.round(paid - totals.total);

  const setLine = (i: number, p: Partial<PayLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const remaining = () => Math.max(0, totals.total - lines.reduce((a, l) => a + toSyp(l), 0));

  const pay = async () => {
    setBusy(true);
    try {
      const r = await api<{ invoiceId: string; change: number }>(`/api/staff/orders/${data.order.id}/checkout`, {
        body: { discount: Number(discount) || 0, payments: lines.filter((l) => Number(l.amount) > 0).map((l) => ({ method: l.method, amount: Number(l.amount), reference: l.reference || undefined })) },
      });
      toast(r.change > 0 ? `انحفظت الفاتورة. الباقي للزبون ${r.change.toLocaleString("en-US")} ${s.currency}` : "انحفظت الفاتورة");
      onPaid(r.invoiceId);
    } catch (e) {
      toast((e as Error).message, "err");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="الدفع">
      <div className="space-y-1.5 text-sm">
        <Row k="المجموع" v={<Money v={totals.subtotal} />} />
        <div className="flex items-center justify-between text-white/70"><span>خصم</span><input className="input w-32 py-1.5 text-left num" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
        {totals.serviceCharge > 0 && <Row k={`خدمة ${s.servicePercent}%`} v={<Money v={totals.serviceCharge} />} />}
        {totals.tax > 0 && <Row k={`ضريبة ${s.taxPercent}%`} v={<Money v={totals.tax} />} />}
        <div className="flex justify-between border-t border-white/10 pt-2 text-xl font-bold"><span>المطلوب</span><Money v={totals.total} /></div>
        <div className="text-left text-xs text-white/40">بالدولار ≈ ${(totals.total / s.usdRate).toFixed(2)} (سعر {s.usdRate})</div>
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="rounded-xl bg-white/5 p-2.5">
            <div className="grid grid-cols-4 gap-1">
              {(["CASH_SYP", "CASH_USD", "SHAM_CASH", "CARD"] as const).map((m) => (
                <button key={m} onClick={() => setLine(i, { method: m, amount: m === "CASH_USD" ? (remaining() / s.usdRate + (l.method === "CASH_USD" ? Number(l.amount) || 0 : toSyp(l) / s.usdRate)).toFixed(2) : String(Math.round(toSyp(l))) })}
                  className={`rounded-lg py-1.5 text-[11px] ${l.method === m ? "bg-brand-400 text-white" : "bg-white/5 text-white/60"}`}>{PAY_LABELS[m]}</button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input className="input num text-left" inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value.replace(/[^\d.]/g, "") })} />
              <span className="w-10 text-xs text-white/50">{l.method === "CASH_USD" ? "$" : s.currency}</span>
              {lines.length > 1 && <button className="text-white/40 hover:text-red-300" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>✕</button>}
            </div>
            {l.method === "SHAM_CASH" && <input className="input mt-2 py-1.5 text-xs" placeholder="رقم العملية بشام كاش (اختياري)" value={l.reference ?? ""} onChange={(e) => setLine(i, { reference: e.target.value })} />}
            {l.method === "CASH_USD" && Number(l.amount) > 0 && <div className="mt-1 text-[11px] text-white/40">= <Money v={toSyp(l)} /></div>}
          </div>
        ))}
        {lines.length < 4 && remaining() > 0 && <button className="btn-ghost w-full py-2 text-xs" onClick={() => setLines((ls) => [...ls, { method: "SHAM_CASH", amount: String(Math.round(remaining())) }])}>+ دفع مقسوم (طريقة تانية)</button>}
      </div>

      <div className={`mt-3 rounded-xl p-3 text-center text-sm font-semibold ${diff < 0 ? "bg-red-500/10 text-red-300" : diff > 0 ? "bg-neon/10 text-neon" : "bg-brand-400/15 text-brand-100"}`}>
        {diff < 0 ? <>ناقص <Money v={-diff} /></> : diff > 0 ? <>الباقي للزبون <Money v={diff} /></> : "المبلغ مظبوط"}
      </div>
      <button disabled={busy || diff < 0} onClick={pay} className="btn-neon mt-3 w-full py-3 text-base">{busy ? <Spinner /> : "تأكيد الدفع وطباعة"}</button>
    </Modal>
  );
}
