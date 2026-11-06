"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useLive } from "@/lib/client";
import { Money, Spinner, Stat } from "@/components/ui";
import { Bars } from "@/components/Bars";
import { addDays } from "@/lib/time";
import { useMe } from "@/components/MeContext";

type Floor = { tables: { order: { total: number } | null; requests: unknown[]; booking: unknown }[] };
type Report = { summary: { total: number; invoices: number; avgTicket: number; guests: number; expenses: number }; days: { day: string; total: number }[]; topItems: { name: string; qty: number }[] };

function today() {
  return new Date(Date.now() + 180 * 60000 - 5 * 3600000).toISOString().slice(0, 10);
}

export default function Dashboard() {
  const me = useMe();
  const { data: floor } = useLive<Floor>("/api/staff/floor", ["floor", "requests"], 30000);
  const [todayR, setToday] = useState<Report | null>(null);
  const [week, setWeek] = useState<Report | null>(null);
  const [bk, setBk] = useState<{ bookings: { status: string; riskLevel: string }[]; waiting: number } | null>(null);

  useEffect(() => {
    api<Report>(`/api/staff/reports?from=${today()}&to=${today()}`).then(setToday).catch(() => {});
    api<Report>(`/api/staff/reports?from=${addDays(today(), -13)}&to=${today()}`).then(setWeek).catch(() => {});
    api<typeof bk>("/api/staff/bookings").then(setBk).catch(() => {});
  }, []);

  const open = floor?.tables.filter((t) => t.order) ?? [];
  const openValue = open.reduce((a, t) => a + (t.order?.total ?? 0), 0);
  const calls = floor?.tables.reduce((a, t) => a + t.requests.length, 0) ?? 0;
  const bkActive = bk?.bookings.filter((b) => ["CONFIRMED", "PENDING", "SEATED"].includes(b.status)).length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">أهلا {me?.name}</h1>
        <p className="text-sm text-white/50">هيك ماشي اليوم بروت</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="مبيعات اليوم" value={todayR ? <Money v={todayR.summary.total} /> : <Spinner />} sub={todayR && `${todayR.summary.invoices} فاتورة · متوسط ${todayR.summary.avgTicket.toLocaleString("en-US")}`} tone="good" />
        <Stat label="طاولات شغالة هلق" value={floor ? `${open.length} / ${floor.tables.length}` : <Spinner />} sub={<>قيمة الطلبات المفتوحة <Money v={openValue} /></>} />
        <Stat label="حجوزات اليوم" value={bk ? bkActive : <Spinner />} sub={bk && bk.waiting > 0 ? `${bk.waiting} بانتظار قرار` : "كلها مرتبة"} tone={bk && bk.waiting > 0 ? "warn" : undefined} />
        <Stat label="نداءات مفتوحة" value={calls} tone={calls > 0 ? "warn" : undefined} sub={<Link href="/staff/requests" className="text-neon">شوف النداءات</Link>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold">آخر أسبوعين</div><Link href="/staff/accounting" className="text-xs text-neon">التقارير كاملة</Link></div>
          {week ? <Bars data={week.days.map((d) => ({ k: d.day, v: d.total }))} label={(k) => k.slice(8)} /> : <Spinner />}
        </div>
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold">الأكتر طلباً (أسبوعين)</div>
          {week?.topItems.slice().sort((a, b) => b.qty - a.qty).slice(0, 7).map((i, k) => (
            <div key={i.name} className="flex justify-between border-b border-white/5 py-1.5 text-sm last:border-0"><span><span className="num text-white/40">{k + 1}.</span> {i.name}</span><span className="num text-white/60">{i.qty}</span></div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/staff/floor" className="card p-4 hover:border-brand-300"><div className="font-semibold">الصالة مباشر</div><div className="text-xs text-white/50">كل طاولة وحالتها</div></Link>
        <Link href="/staff/admin/menu" className="card p-4 hover:border-brand-300"><div className="font-semibold">تعديل الأسعار</div><div className="text-xs text-white/50">صنف صنف أو رفع جماعي بنسبة</div></Link>
        <Link href="/staff/admin/risk" className="card p-4 hover:border-brand-300"><div className="font-semibold">كشف الحجوزات الوهمية</div><div className="text-xs text-white/50">شو عم يمسك النظام</div></Link>
      </div>
    </div>
  );
}
