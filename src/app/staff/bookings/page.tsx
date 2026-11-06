"use client";
import { useEffect, useMemo, useState } from "react";
import { api, useLive } from "@/lib/client";
import { Empty, Modal, RiskBadge, Spinner, StatusBadge, useToast, Field } from "@/components/ui";
import { addDays, arDateLabel, fmtTime, localDateStr } from "@/lib/time";
import { useMe } from "@/components/MeContext";

type Bk = {
  id: string; code: string; name: string; phone: string; partySize: number; startAt: string; status: string; source: string; notes: string | null;
  riskScore: number; riskLevel: string; riskReasons: string[]; holdUntil: string | null; createdAt: string;
  table: { id: string; label: string; seats: number } | null;
  customer: { completed: number; noShows: number; cancellations: number; blocked: boolean } | null;
};

const FILTERS = [["all", "الكل"], ["action", "بدها قرار"], ["active", "جاية"], ["closed", "منتهية"]] as const;

export default function BookingsPage() {
  const toast = useToast();
  const me = useMe();
  const manage = me?.perms.includes("bookings.manage");
  const [date, setDate] = useState(() => localDateStr(new Date()));
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const { data, reload } = useLive<{ bookings: Bk[]; waiting: number }>(`/api/staff/bookings?date=${date}`, ["bookings"], 20000);
  const [open, setOpen] = useState<Bk | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [reason, setReason] = useState("");

  const list = useMemo(() => (data?.bookings ?? []).filter((b) =>
    filter === "all" ? true : filter === "action" ? ["PENDING", "REVIEW"].includes(b.status) : filter === "active" ? ["CONFIRMED", "PENDING", "REVIEW", "SEATED"].includes(b.status) : ["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED", "EXPIRED"].includes(b.status),
  ), [data, filter]);

  const act = async (b: Bk, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await api(`/api/staff/bookings/${b.id}`, { method: "PATCH", body: { action, ...extra } });
      toast("تم");
      setOpen(null);
      setReason("");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const late = (b: Bk) => b.status === "CONFIRMED" && Date.now() - new Date(b.startAt).getTime() > 20 * 60000;
  const wa = (b: Bk) => `https://wa.me/963${b.phone.replace(/^0/, "")}?text=${encodeURIComponent(`مرحبا ${b.name}، معك Route 66. عم نأكد حجزك ${arDateLabel(localDateStr(new Date(b.startAt)))} الساعة ${fmtTime(b.startAt)} لـ ${b.partySize} أشخاص. جاي؟`)}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3" onClick={() => setDate((d) => addDays(d, -1))}>→</button>
          <input type="date" className="input w-auto py-2" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn-ghost px-3" onClick={() => setDate((d) => addDays(d, 1))}>←</button>
          <button className="btn-ghost" onClick={() => setDate(localDateStr(new Date()))}>اليوم</button>
        </div>
        <div className="flex items-center gap-2">
          {(data?.waiting ?? 0) > 0 && <span className="chip bg-red-500 text-white">{data!.waiting} بانتظار قرار</span>}
          {manage && <button className="btn-neon" onClick={() => setNewOpen(true)}>+ حجز تلفون</button>}
        </div>
      </div>
      <div className="mb-3 flex gap-1">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`tab ${filter === k ? "tab-active" : ""}`}>{l}</button>)}</div>

      {!data ? <Spinner /> : list.length === 0 ? <Empty>ما في حجوزات {arDateLabel(date)}</Empty> : (
        <div className="card divide-y divide-white/5">
          {list.map((b) => (
            <button key={b.id} onClick={() => setOpen(b)} className="flex w-full flex-wrap items-center gap-3 p-3 text-right hover:bg-white/[.03] sm:flex-nowrap">
              <div className="num w-14 text-lg font-bold">{fmtTime(b.startAt)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">{b.name}{b.customer?.blocked && <span className="chip bg-red-500/20 text-red-300">محظور</span>}</div>
                <div className="text-xs text-white/50"><span className="num">{b.phone}</span> · {b.partySize} أشخاص · {b.table ? `طاولة ${b.table.label}` : "بلا طاولة"}{b.source !== "ONLINE" && " · تلفون"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {b.source === "ONLINE" && <RiskBadge level={b.riskLevel} score={b.riskScore} />}
                <StatusBadge status={b.status} />
                {late(b) && <span className="chip bg-red-500/15 text-red-300">متأخرين</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.name} · ${fmtTime(open.startAt)}` : ""}>
        {open && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Info k="رقم الحجز" v={<span className="num">{open.code}</span>} />
              <Info k="الحالة" v={<StatusBadge status={open.status} />} />
              <Info k="الموبايل" v={<a href={`tel:${open.phone}`} className="num text-neon">{open.phone}</a>} />
              <Info k="الأشخاص / الطاولة" v={`${open.partySize} · ${open.table?.label ?? "—"}`} />
            </div>
            {open.notes && <div className="rounded-xl bg-white/5 p-3 text-white/70">{open.notes}</div>}
            {open.customer && (
              <div className="rounded-xl bg-white/5 p-3">
                <div className="mb-1 text-xs text-white/50">سجل الزبون</div>
                <div className="flex gap-4"><span>حضر <b className="num text-brand-300">{open.customer.completed}</b></span><span>ما إجا <b className="num text-red-300">{open.customer.noShows}</b></span><span>ألغى <b className="num">{open.customer.cancellations}</b></span></div>
              </div>
            )}
            {open.source === "ONLINE" && (
              <div className="rounded-xl bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs text-white/50">تقييم الخطر</span><RiskBadge level={open.riskLevel} score={open.riskScore} /></div>
                {open.riskReasons.length ? <ul className="list-inside list-disc space-y-1 text-white/70">{open.riskReasons.map((r) => <li key={r}>{r}</li>)}</ul> : <div className="text-white/50">ما في إشارات مشبوهة</div>}
              </div>
            )}
            {manage && (
              <div className="space-y-2">
                {["PENDING", "REVIEW"].includes(open.status) && (
                  <div className="grid grid-cols-2 gap-2">
                    <a href={wa(open)} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white">واتساب للزبون</a>
                    <button className="btn-primary" onClick={() => act(open, "confirm")}>تأكيد الحجز</button>
                  </div>
                )}
                {open.status === "EXPIRED" && <button className="btn-primary w-full" onClick={() => act(open, "confirm")}>رجّع الحجز وأكده</button>}
                {open.status === "CONFIRMED" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-primary" onClick={() => act(open, "seat")}>وصلوا</button>
                    <button className="btn-ghost text-red-300" onClick={() => act(open, "noshow")}>ما إجوا</button>
                  </div>
                )}
                {open.status === "SEATED" && <button className="btn-ghost w-full" onClick={() => act(open, "complete")}>خلصوا</button>}
                {["PENDING", "REVIEW", "CONFIRMED"].includes(open.status) && (
                  <div className="space-y-2 rounded-xl border border-red-500/20 p-3">
                    <input className="input py-2" placeholder="سبب (اختياري)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <button className="btn-ghost text-xs" onClick={() => act(open, "cancel", { reason })}>إلغاء</button>
                      <button className="btn-ghost text-xs text-red-300" onClick={() => act(open, "fake", { reason })}>وهمي</button>
                      <button className="btn-danger text-xs" onClick={() => act(open, "block", { reason })}>وهمي + حظر</button>
                    </div>
                    <p className="text-[11px] text-white/40">"وهمي" بيعلّم النظام إنو هالنوع من الحجوزات مشبوه. "حظر" بيمنع هالرقم والجهاز يحجزوا أونلاين.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {newOpen && <NewBooking date={date} onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); reload(); }} />}
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="rounded-xl bg-white/5 p-2.5"><div className="text-[11px] text-white/45">{k}</div><div className="mt-0.5 font-semibold">{v}</div></div>;
}

function NewBooking({ date: initial, onClose, onDone }: { date: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", phone: "", partySize: 2, date: initial, time: "20:00", tableId: "", notes: "" });
  const [tables, setTables] = useState<{ id: string; label: string; seats: number; state: string; zoneId: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!/^\d{2}:\d{2}$/.test(f.time)) return;
    api<{ tables: typeof tables }>(`/api/public/availability?date=${f.date}&time=${f.time}&party=${f.partySize}`).then((r) => setTables(r.tables)).catch(() => setTables([]));
  }, [f.date, f.time, f.partySize]);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ risk: { level: string; reasons: string[] } }>("/api/staff/bookings", { body: { ...f, tableId: f.tableId || null, notes: f.notes || undefined } });
      toast(r.risk.level === "HIGH" ? "انحفظ. انتبه: الزبون عنده سجل مشبوه" : "انحفظ الحجز");
      onDone();
    } catch (e) {
      toast((e as Error).message, "err");
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="حجز جديد (تلفون)">
      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="الموبايل"><input className="input num text-left" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="الساعة"><input type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="عدد الأشخاص"><input type="number" min={1} className="input num" value={f.partySize} onChange={(e) => setF({ ...f, partySize: Number(e.target.value) || 1 })} /></Field>
        <Field label="الطاولة">
          <select className="input" value={f.tableId} onChange={(e) => setF({ ...f, tableId: e.target.value })}>
            <option value="">بدون تحديد</option>
            {tables.filter((t) => t.state === "free").map((t) => <option key={t.id} value={t.id}>{t.label} ({t.seats})</option>)}
          </select>
        </Field>
      </div>
      <Field label="ملاحظة"><input className="input mt-0" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <button disabled={busy || !f.name || !f.phone} onClick={save} className="btn-neon mt-4 w-full">{busy ? <Spinner /> : "حفظ"}</button>
    </Modal>
  );
}
