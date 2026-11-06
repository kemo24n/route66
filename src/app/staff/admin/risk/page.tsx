"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Empty, Field, RiskBadge, Spinner, Stat, StatusBadge, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";

type Risk = {
  model: { samples: number; accuracy: number | null; trainedAt: string | null };
  features: { key: string; label: string; weight: number; prior: number }[];
  last30: { noShowRate: number; finished: number; LOW: { total: number; noShows: number }; MEDIUM: { total: number; noShows: number }; HIGH: { total: number; noShows: number } };
  flagged: { id: string; name: string; phone: string; startAt: string; riskScore: number; riskLevel: string; status: string; riskReasons: string[] }[];
  blocked: { id: string; type: string; value: string; reason: string | null; createdAt: string }[];
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function RiskPage() {
  const toast = useToast();
  const [d, setD] = useState<Risk | null>(null);
  const [busy, setBusy] = useState(false);
  const [blk, setBlk] = useState({ type: "PHONE", value: "", reason: "" });
  const load = useCallback(() => api<Risk>("/api/admin/risk").then(setD), []);
  useEffect(() => { load(); }, [load]);

  const retrain = async () => {
    setBusy(true);
    try {
      const r = await api<{ samples: number; positives: number; accuracy: number | null }>("/api/admin/risk", { method: "POST" });
      toast(`اتدرّب النظام على ${r.samples} حجز (${r.positives} وهمي أو ما إجا)`);
      load();
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  const addBlock = async () => {
    try { await api("/api/admin/blocks", { body: { ...blk, reason: blk.reason || undefined } }); setBlk({ ...blk, value: "", reason: "" }); load(); } catch (e) { toast((e as Error).message, "err"); }
  };
  const unblock = async (type: string, value: string) => { await api("/api/admin/blocks", { method: "DELETE", body: { type, value } }); load(); };

  if (!d) return <Spinner />;
  const maxW = Math.max(...d.features.map((f) => Math.abs(f.weight)), 1);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">كشف الحجوزات الوهمية</h1>
          <p className="text-sm text-white/50">كل حجز أونلاين بينفحص قبل ما يحجز الطاولة. النظام بيتعلم من الحجوزات يلي ما إجا أصحابها.</p>
        </div>
        <button className="btn-neon" onClick={retrain} disabled={busy}>{busy ? <Spinner /> : "درّب النظام على آخر البيانات"}</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="نسبة الغياب (30 يوم)" value={pct(d.last30.noShowRate * d.last30.finished, d.last30.finished)} sub={`${d.last30.finished} حجز منتهي`} />
        <Stat label="خطر منخفض · ما إجوا" value={pct(d.last30.LOW.noShows, d.last30.LOW.total)} sub={`${d.last30.LOW.total} حجز`} tone="good" />
        <Stat label="خطر متوسط · ما إجوا" value={pct(d.last30.MEDIUM.noShows, d.last30.MEDIUM.total)} sub={`${d.last30.MEDIUM.total} حجز`} tone="warn" />
        <Stat label="خطر عالي · ما إجوا" value={pct(d.last30.HIGH.noShows, d.last30.HIGH.total)} sub={`${d.last30.HIGH.total} حجز`} tone="bad" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="font-semibold">شو عم يراقب النظام</div>
            <div className="text-xs text-white/40">{d.model.trainedAt ? `آخر تدريب ${fmtDateTime(d.model.trainedAt)} · ${d.model.samples} حجز${d.model.accuracy != null ? ` · دقة ${Math.round(d.model.accuracy * 100)}%` : ""}` : "لسا ما اتدرّب، شغّال بالإعدادات الأساسية"}</div>
          </div>
          <p className="mb-3 text-[11px] text-white/40">الخط الأطول يعني الإشارة أقوى بكشف الحجز الوهمي</p>
          <div className="space-y-2">
            {d.features.map((f) => (
              <div key={f.key}>
                <div className="mb-0.5 text-xs text-white/70">{f.label}</div>
                <div className="h-2 rounded-full bg-white/5"><div className={`h-2 rounded-full ${f.weight >= 2 ? "bg-red-400" : f.weight >= 1 ? "bg-neon" : "bg-brand-400"}`} style={{ width: `${(Math.max(0, f.weight) / maxW) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between"><div className="font-semibold">حجوزات بدها قرار</div><Link href="/staff/bookings" className="text-xs text-neon">الحجوزات</Link></div>
            {d.flagged.length === 0 ? <Empty>ما في شي مشبوه هلق</Empty> : d.flagged.map((b) => (
              <div key={b.id} className="border-b border-white/5 py-2 text-sm last:border-0">
                <div className="flex items-center justify-between"><span>{b.name} · <span className="num text-white/50">{b.phone}</span></span><span className="flex gap-1"><RiskBadge level={b.riskLevel} score={b.riskScore} /><StatusBadge status={b.status} /></span></div>
                <div className="text-xs text-white/50">{fmtDateTime(b.startAt)} · {b.riskReasons.slice(0, 2).join("، ")}</div>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <div className="mb-2 font-semibold">قائمة الحظر</div>
            <div className="mb-3 grid grid-cols-[100px_1fr] gap-2">
              <select className="input py-2" value={blk.type} onChange={(e) => setBlk({ ...blk, type: e.target.value })}><option value="PHONE">رقم</option><option value="IP">IP</option><option value="DEVICE">جهاز</option></select>
              <input className="input py-2" dir="ltr" placeholder={blk.type === "PHONE" ? "09xxxxxxxx" : "القيمة"} value={blk.value} onChange={(e) => setBlk({ ...blk, value: e.target.value })} />
            </div>
            <div className="flex gap-2"><input className="input py-2" placeholder="السبب" value={blk.reason} onChange={(e) => setBlk({ ...blk, reason: e.target.value })} /><button className="btn-danger" disabled={blk.value.length < 3} onClick={addBlock}>حظر</button></div>
            <div className="mt-3 max-h-56 divide-y divide-white/5 overflow-y-auto text-xs">
              {d.blocked.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2">
                  <span><span className="chip bg-white/10">{b.type === "PHONE" ? "رقم" : b.type === "IP" ? "IP" : "جهاز"}</span> <span className="num" dir="ltr">{b.value.length > 20 ? b.value.slice(0, 18) + "…" : b.value}</span> <span className="text-white/40">{b.reason}</span></span>
                  <button className="text-white/50 hover:text-white" onClick={() => unblock(b.type, b.value)}>فك الحظر</button>
                </div>
              ))}
              {d.blocked.length === 0 && <div className="py-3 text-center text-white/40">ما في حدا محظور</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 text-sm leading-relaxed text-white/60">
        <div className="mb-1 font-semibold text-white">كيف بيشتغل</div>
        كل حجز أونلاين بياخد علامة من 0 لـ 100 حسب الإشارات فوق (الرقم، الاسم، تاريخ الزبون، كم حجز من نفس الجهاز والشبكة، سرعة تعبئة الطلب...).
        الحجز النظيف بيتأكد فوراً. المتوسط بيحجز الطاولة مؤقتاً وبيطلب من الزبون يأكد عالواتساب، وإذا ما أكد بتنفك الطاولة لحالها.
        العالي بيروح للمراجعة وما بيحجز الطاولة. كل ما تعلّم على حجز "ما إجوا" أو "وهمي" ودرّبت النظام، بيصير أدق بزبائن روت بالذات.
      </div>
    </div>
  );
}
