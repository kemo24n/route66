"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type T = { id: string; label: string; zoneId: string };

/** A4 sheet of table cards: cut, laminate, put on the tables */
export default function PrintQr() {
  const [d, setD] = useState<{ zones: { id: string; name: string }[]; tables: T[] } | null>(null);
  useEffect(() => { api<typeof d>("/api/admin/floor").then(setD); }, []);
  if (!d) return null;
  const sorted = [...d.tables].sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <div className="no-print mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">كل كرت إله رمز خاص بالطاولة. إذا انطبع كرت لطاولة غلط، بيطلع الطلب على الطاولة الغلط.</div>
        <button onClick={() => window.print()} className="rounded bg-black px-4 py-2 text-white">طباعة</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {sorted.map((t) => (
          <div key={t.id} className="flex break-inside-avoid flex-col items-center rounded-2xl border-2 border-[#084607] p-4 text-center">
            <img src="/img/logo.svg" alt="" className="h-12 w-12" />
            <div className="mt-1 text-sm font-bold text-[#084607]">Route 66</div>
            <img src={`/api/admin/qr/${t.id}`} alt="" className="my-2 h-36 w-36" />
            <div className="text-2xl font-bold">طاولة {t.label}</div>
            <div className="mt-1 text-xs text-gray-600">امسح الكود: المنيو · نادي الويتر · اطلب الحساب</div>
            <div className="text-[10px] text-gray-400">{d.zones.find((z) => z.id === t.zoneId)?.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
