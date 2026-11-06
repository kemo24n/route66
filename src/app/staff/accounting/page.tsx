"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Empty, Field, Modal, Money, Spinner, Stat, useToast } from "@/components/ui";
import { Bars, HBar } from "@/components/Bars";
import { addDays, fmtDateTime, fmtTime } from "@/lib/time";
import { PAY_LABELS } from "@/lib/money";
import { useMe } from "@/components/MeContext";

type Report = {
  from: string; to: string;
  summary: { invoices: number; gross: number; discount: number; service: number; tax: number; total: number; avgTicket: number; guests: number; takeaway: number; expenses: number; net: number; voids: number; voidValue: number };
  payments: Record<string, number>; topItems: { name: string; qty: number; revenue: number }[]; byCategory: { name: string; total: number }[];
  byHour: { hour: number; total: number }[]; days: { day: string; total: number; count: number }[]; expenses: { id: string; category: string; amount: number; note: string | null; createdAt: string }[];
};

function today() {
  const d = new Date(Date.now() + 180 * 60000 - 5 * 3600000);
  return d.toISOString().slice(0, 10);
}

export default function Accounting() {
  const me = useMe();
  const canReport = me?.perms.includes("accounting");
  const [tab, setTab] = useState<"report" | "invoices" | "shift" | "expenses">("report");
  useEffect(() => { if (me && !canReport) setTab("shift"); }, [me, canReport]);
  const tabs = [["report", "التقارير"], ["invoices", "الفواتير"], ["shift", "الوردية والصندوق"], ["expenses", "المصاريف"]] as const;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.filter(([k]) => canReport || k === "shift" || k === "expenses").map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`tab ${tab === k ? "tab-active" : ""}`}>{l}</button>)}
      </div>
      {tab === "report" && <ReportTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "shift" && <ShiftTab />}
      {tab === "expenses" && <ExpensesTab />}
    </div>
  );
}

function ReportTab() {
  const [range, setRange] = useState<[string, string]>(() => [today(), today()]);
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => { setR(null); api<Report>(`/api/staff/reports?from=${range[0]}&to=${range[1]}`).then(setR); }, [range]);
  const preset = (days: number) => setRange([addDays(today(), -days + 1), today()]);
  const csv = () => {
    if (!r) return;
    const rows = [["اليوم", "عدد الفواتير", "المبيعات"], ...r.days.map((d) => [d.day, d.count, d.total])];
    const blob = new Blob(["﻿" + rows.map((x) => x.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `route66-sales-${r.from}_${r.to}.csv`;
    a.click();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost py-2" onClick={() => preset(1)}>اليوم</button>
        <button className="btn-ghost py-2" onClick={() => setRange([addDays(today(), -1), addDays(today(), -1)])}>مبارح</button>
        <button className="btn-ghost py-2" onClick={() => preset(7)}>آخر 7 أيام</button>
        <button className="btn-ghost py-2" onClick={() => preset(30)}>آخر 30 يوم</button>
        <input type="date" className="input w-auto py-2" value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} />
        <span className="text-white/40">لـ</span>
        <input type="date" className="input w-auto py-2" value={range[1]} onChange={(e) => setRange([range[0], e.target.value])} />
        <button className="btn-ghost py-2" onClick={csv}>تصدير Excel</button>
      </div>
      {!r ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="صافي المبيعات" value={<Money v={r.summary.total} />} sub={`${r.summary.invoices} فاتورة`} tone="good" />
            <Stat label="متوسط الفاتورة" value={<Money v={r.summary.avgTicket} />} sub={`${r.summary.guests} زبون`} />
            <Stat label="المصاريف" value={<Money v={r.summary.expenses} />} sub={<>بعد المصاريف <Money v={r.summary.net} /></>} />
            <Stat label="ضريبة / خدمة / خصم" value={<Money v={r.summary.tax} />} sub={<>خدمة <Money v={r.summary.service} /> · خصم <Money v={r.summary.discount} /></>} />
          </div>
          {r.summary.voids > 0 && <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">انلغى {r.summary.voids} صنف بعد ما انبعت للمطبخ بقيمة <Money v={r.summary.voidValue} />. التفاصيل بسجل العمليات.</div>}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-2">
              <div className="mb-3 text-sm font-semibold">المبيعات حسب اليوم</div>
              <Bars data={r.days.map((d) => ({ k: d.day, v: d.total }))} label={(k) => k.slice(8)} />
            </div>
            <div className="card p-4">
              <div className="mb-3 text-sm font-semibold">طرق الدفع</div>
              <HBar rows={Object.entries(r.payments).map(([k, v]) => ({ name: PAY_LABELS[k], v }))} />
            </div>
            <div className="card p-4">
              <div className="mb-3 text-sm font-semibold">أكتر الأصناف مبيعاً</div>
              <HBar rows={r.topItems.map((i) => ({ name: i.name, v: i.revenue, sub: `${i.qty}×` }))} />
            </div>
            <div className="card p-4">
              <div className="mb-3 text-sm font-semibold">حسب القسم</div>
              <HBar rows={r.byCategory.map((c) => ({ name: c.name, v: c.total }))} />
            </div>
            <div className="card p-4">
              <div className="mb-3 text-sm font-semibold">ساعات الذروة</div>
              {r.byHour.length ? <Bars data={r.byHour.map((h) => ({ k: String(h.hour), v: h.total }))} color="#F2C14E" /> : <Empty>ما في مبيعات</Empty>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InvoicesTab() {
  const [day, setDay] = useState(today());
  const [d, setD] = useState<{ invoices: { id: string; number: number; total: number; createdAt: string; orderNumber: number; type: string; table: string | null; cashier: string; methods: string[]; discount: number }[] } | null>(null);
  useEffect(() => { setD(null); api<typeof d>(`/api/staff/invoices?day=${day}`).then(setD); }, [day]);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input type="date" className="input w-auto py-2" value={day} onChange={(e) => setDay(e.target.value)} />
        {d && <span className="text-sm text-white/60">{d.invoices.length} فاتورة · <Money v={d.invoices.reduce((a, i) => a + i.total, 0)} /></span>}
      </div>
      {!d ? <Spinner /> : d.invoices.length === 0 ? <Empty>ما في فواتير بهاليوم</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-white/50"><tr className="border-b border-white/5"><th className="p-3 text-right">رقم</th><th className="p-3 text-right">الوقت</th><th className="p-3 text-right">طاولة</th><th className="p-3 text-right">الدفع</th><th className="p-3 text-right">الكاشير</th><th className="p-3 text-left">المبلغ</th><th /></tr></thead>
            <tbody>
              {d.invoices.map((i) => (
                <tr key={i.id} className="border-b border-white/5 last:border-0">
                  <td className="num p-3">{i.number}</td>
                  <td className="num p-3">{fmtTime(i.createdAt)}</td>
                  <td className="p-3">{i.type === "TAKEAWAY" ? "سفري" : i.table}</td>
                  <td className="p-3 text-xs">{i.methods.map((m) => PAY_LABELS[m]).join(" + ")}</td>
                  <td className="p-3 text-xs text-white/60">{i.cashier}</td>
                  <td className="p-3 text-left"><Money v={i.total} />{i.discount > 0 && <div className="text-[10px] text-neon">خصم {i.discount.toLocaleString("en-US")}</div>}</td>
                  <td className="p-3"><a href={`/staff/print/invoice/${i.id}`} target="_blank" className="text-xs text-neon hover:underline">طباعة</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type ShiftSum = { invoices: number; sales: number; cashSyp: number; cashUsdSyp: number; cashUsd: number; shamCash: number; card: number; expenses: number; expectedCash: number };
type ShiftRes = {
  current: { id: string; openedAt: string; openingCash: number; summary: ShiftSum } | null;
  recent: { id: string; user: string; openedAt: string; closedAt: string | null; openingCash: number; countedCash: number | null; expectedCash: number | null }[];
};

function ShiftTab() {
  const toast = useToast();
  const [d, setD] = useState<ShiftRes | null>(null);
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const load = useCallback(() => api<ShiftRes>("/api/staff/shifts").then(setD), []);
  useEffect(() => { load(); }, [load]);
  const post = async (body: object, msg: string) => {
    try {
      const r = await api<{ difference?: number }>("/api/staff/shifts", { body });
      toast(r.difference !== undefined ? (r.difference === 0 ? "الصندوق مظبوط" : `فرق بالصندوق: ${r.difference.toLocaleString("en-US")}`) : msg, r.difference ? "err" : "ok");
      setCloseOpen(false);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  if (!d) return <Spinner />;
  const s = d.current?.summary;
  return (
    <div className="space-y-4">
      {!d.current ? (
        <div className="card max-w-md p-5">
          <div className="font-semibold">ما عندك وردية مفتوحة</div>
          <Field label="المبلغ يلي بالصندوق ببداية الوردية (ليرة)"><input className="input num" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value.replace(/\D/g, ""))} /></Field>
          <button className="btn-primary mt-3 w-full" onClick={() => post({ action: "open", openingCash: Number(opening) || 0 }, "انفتحت الوردية")}>فتح وردية</button>
        </div>
      ) : s && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between"><div className="font-semibold">الوردية الحالية · من {fmtDateTime(d.current.openedAt)}</div><button className="btn-danger" onClick={() => setCloseOpen(true)}>تسكير الوردية</button></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="المبيعات" value={<Money v={s.sales} />} sub={`${s.invoices} فاتورة`} />
            <Stat label="كاش ليرة" value={<Money v={s.cashSyp} />} />
            <Stat label="كاش دولار" value={`$${s.cashUsd.toFixed(2)}`} sub={<Money v={s.cashUsdSyp} />} />
            <Stat label="شام كاش + بطاقة" value={<Money v={s.shamCash + s.card} />} />
            <Stat label="بداية الصندوق" value={<Money v={d.current.openingCash} />} />
            <Stat label="مصاريف من الصندوق" value={<Money v={s.expenses} />} />
            <Stat label="لازم يكون بالصندوق (ليرة)" value={<Money v={s.expectedCash} />} tone="warn" sub="+ الدولار لحال" />
          </div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <div className="p-3 text-sm font-semibold">آخر الورديات</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-white/50"><tr><th className="p-2 text-right">الموظف</th><th className="p-2 text-right">من</th><th className="p-2 text-right">لـ</th><th className="p-2 text-left">المتوقع</th><th className="p-2 text-left">المعدود</th><th className="p-2 text-left">الفرق</th></tr></thead>
          <tbody>
            {d.recent.map((r) => {
              const diff = r.countedCash != null && r.expectedCash != null ? r.countedCash - r.expectedCash : null;
              return (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="p-2">{r.user}</td><td className="num p-2 text-xs">{fmtDateTime(r.openedAt)}</td><td className="num p-2 text-xs">{r.closedAt ? fmtDateTime(r.closedAt) : "مفتوحة"}</td>
                  <td className="p-2 text-left">{r.expectedCash != null ? <Money v={r.expectedCash} /> : "—"}</td>
                  <td className="p-2 text-left">{r.countedCash != null ? <Money v={r.countedCash} /> : "—"}</td>
                  <td className={`p-2 text-left ${diff ? "text-red-300" : "text-brand-300"}`}>{diff != null ? <Money v={diff} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="تسكير الوردية">
        <p className="mb-2 text-sm text-white/60">عدّ الكاش بالليرة يلي بالصندوق واكتبه. الدولار بينعد لحال.</p>
        <input className="input num" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} autoFocus />
        <button className="btn-danger mt-3 w-full" onClick={() => post({ action: "close", countedCash: Number(counted) || 0 }, "تسكرت الوردية")}>تسكير</button>
      </Modal>
    </div>
  );
}

function ExpensesTab() {
  const toast = useToast();
  const [day, setDay] = useState(today());
  const [list, setList] = useState<{ id: string; category: string; amount: number; note: string | null; createdAt: string }[] | null>(null);
  const [f, setF] = useState({ category: "خضار", amount: "", note: "" });
  const load = useCallback(() => api<{ expenses: NonNullable<typeof list> }>(`/api/staff/expenses?day=${day}`).then((r) => setList(r.expenses)), [day]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    try {
      await api("/api/staff/expenses", { body: { category: f.category, amount: Number(f.amount), note: f.note || undefined } });
      setF({ ...f, amount: "", note: "" });
      toast("انضاف المصروف");
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="card h-fit p-4">
        <div className="mb-3 font-semibold">مصروف جديد</div>
        <Field label="النوع">
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {["خضار", "لحوم ودجاج", "خبز", "غاز", "مازوت", "تنظيف", "صيانة", "رواتب", "إيجار", "كهربا وأمبيرات", "تسويق", "غير ذلك"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <div className="mt-3"><Field label="المبلغ (ليرة)"><input className="input num" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} /></Field></div>
        <div className="mt-3"><Field label="ملاحظة"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
        <button className="btn-primary mt-3 w-full" disabled={!Number(f.amount)} onClick={add}>إضافة</button>
        <p className="mt-2 text-[11px] text-white/40">إذا عندك وردية مفتوحة، المصروف بينخصم من الصندوق تبعها.</p>
      </div>
      <div>
        <input type="date" className="input mb-3 w-auto py-2" value={day} onChange={(e) => setDay(e.target.value)} />
        {!list ? <Spinner /> : list.length === 0 ? <Empty>ما في مصاريف</Empty> : (
          <div className="card divide-y divide-white/5">
            {list.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 text-sm">
                <div><div className="font-semibold">{e.category}</div><div className="text-xs text-white/50">{e.note} <span className="num">{fmtTime(e.createdAt)}</span></div></div>
                <Money v={e.amount} />
              </div>
            ))}
            <div className="flex justify-between p-3 font-bold"><span>المجموع</span><Money v={list.reduce((a, e) => a + e.amount, 0)} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
