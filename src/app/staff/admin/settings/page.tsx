"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Field, Spinner, useToast } from "@/components/ui";
import { useMe } from "@/components/MeContext";
import type { Setting } from "@/db/schema";

export default function SettingsPage() {
  const toast = useToast();
  const me = useMe();
  const moneyOnly = me?.role === "ACCOUNTANT";
  const [s, setS] = useState<Setting | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api<Setting>("/api/admin/settings").then(setS); }, []);
  if (!s) return <Spinner />;
  const set = <K extends keyof Setting>(k: K, v: Setting[K]) => setS({ ...s, [k]: v });
  const num = (k: keyof Setting) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  const save = async () => {
    setSaving(true);
    try {
      const keys = moneyOnly ? ["taxPercent", "servicePercent", "usdRate", "currencyLabel"] : Object.keys(s).filter((k) => !["id", "updatedAt"].includes(k));
      await api("/api/admin/settings", { method: "PATCH", body: Object.fromEntries(keys.map((k) => [k, (s as Record<string, unknown>)[k]])) });
      toast("انحفظت الإعدادات");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">العملة والضريبة</h2>
        <p className="mb-4 text-xs text-white/40">بتنطبق على الفواتير الجديدة. الفواتير القديمة بتحتفظ بالنسب يلي انعملت فيها.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="سعر الدولار (ليرة)"><input className="input num" type="number" value={s.usdRate} onChange={num("usdRate")} /></Field>
          <Field label="الضريبة %"><input className="input num" type="number" step="0.5" value={s.taxPercent} onChange={num("taxPercent")} /></Field>
          <Field label="رسم الخدمة %"><input className="input num" type="number" step="0.5" value={s.servicePercent} onChange={num("servicePercent")} /></Field>
          <Field label="رمز العملة"><input className="input" value={s.currencyLabel} onChange={(e) => set("currencyLabel", e.target.value)} /></Field>
        </div>
      </section>

      {!moneyOnly && (
        <>
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">المحل</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الاسم"><input className="input" value={s.restaurantName} onChange={(e) => set("restaurantName", e.target.value)} /></Field>
              <Field label="العنوان"><input className="input" value={s.addressAr} onChange={(e) => set("addressAr", e.target.value)} /></Field>
              <Field label="رقم الهاتف"><input className="input num" value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="واتساب لتأكيد الحجوزات" hint="بالصيغة الدولية بدون + (963...)"><input className="input num" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
              <Field label="يفتح الساعة"><input className="input" type="time" value={s.openTime} onChange={(e) => set("openTime", e.target.value)} /></Field>
              <Field label="يسكّر الساعة"><input className="input" type="time" value={s.closeTime} onChange={(e) => set("closeTime", e.target.value)} /></Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold">الحجز أونلاين</h2>
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.bookingEnabled} onChange={(e) => set("bookingEnabled", e.target.checked)} /> الحجز أونلاين شغّال</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.qrOrderingEnabled} onChange={(e) => set("qrOrderingEnabled", e.target.checked)} /> الطلب من QR الطاولة شغّال</label>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="مدة الحجز (دقيقة)"><input className="input num" type="number" value={s.bookingDurationMin} onChange={num("bookingDurationMin")} /></Field>
              <Field label="كل كم دقيقة وقت"><input className="input num" type="number" value={s.slotMinutes} onChange={num("slotMinutes")} /></Field>
              <Field label="أكبر عدد أشخاص"><input className="input num" type="number" value={s.maxPartySize} onChange={num("maxPartySize")} /></Field>
              <Field label="كم يوم لقدام"><input className="input num" type="number" value={s.maxDaysAhead} onChange={num("maxDaysAhead")} /></Field>
              <Field label="أقل وقت قبل الحجز (دقيقة)"><input className="input num" type="number" value={s.minLeadMinutes} onChange={num("minLeadMinutes")} /></Field>
              <Field label="مهلة التأكيد بالواتساب (دقيقة)"><input className="input num" type="number" value={s.pendingHoldMinutes} onChange={num("pendingHoldMinutes")} /></Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 font-semibold">كشف الحجوزات الوهمية</h2>
            <p className="mb-4 text-xs text-white/40">كل حجز بياخد علامة خطر من 0 لـ 100. تحت الحد الأول بيتأكد لحاله، بين الحدين بينطر تأكيد واتساب، وفوق الحد التاني بيروح للمراجعة وما بيحجز الطاولة.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="تأكيد تلقائي إذا العلامة أقل من"><input className="input num" type="number" value={s.riskAutoConfirmBelow} onChange={num("riskAutoConfirmBelow")} /></Field>
              <Field label="مراجعة يدوية إذا العلامة أكبر من"><input className="input num" type="number" value={s.riskReviewAbove} onChange={num("riskReviewAbove")} /></Field>
            </div>
          </section>
        </>
      )}
      <button className="btn-neon px-8 py-3" onClick={save} disabled={saving}>{saving ? <Spinner /> : "حفظ"}</button>
    </div>
  );
}
