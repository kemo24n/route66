"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { qrDataUrl } from "@/lib/qrcard";

type Row = { id: string; label: string; zone: string; path: string };

/** A4 sheet of table cards: cut, laminate, put on the tables */
export default function PrintQr() {
  const [rows, setRows] = useState<(Row & { qr: string; url: string })[] | null>(null);
  useEffect(() => {
    api<{ saved: string | null; tables: Row[] }>("/api/admin/qr-tables").then(async (r) => {
      const base = r.saved || window.location.origin;
      const list = await Promise.all(r.tables.map(async (t) => ({ ...t, url: base + t.path, qr: await qrDataUrl(base + t.path, 500) })));
      setRows(list);
      setTimeout(() => window.print(), 700);
    });
  }, []);
  if (!rows) return <div className="p-10 text-center">عم نجهز الكروت...</div>;
  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <style>{`@page{size:A4;margin:10mm}`}</style>
      <div className="no-print mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">كل كرت إله كود خاص بطاولته. حط كل كرت عالطاولة يلي رقمها مكتوب عليه.</div>
        <button onClick={() => window.print()} className="rounded bg-black px-4 py-2 text-white">طباعة</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {rows.map((t) => (
          <div key={t.id} className="break-inside-avoid overflow-hidden rounded-2xl border-[3px] border-[#15170F] bg-[#F3ECDD] text-center">
            <div className="flex items-center justify-between bg-[#0E4A23] px-3 py-2 text-[#F3ECDD]">
              <img src="/img/logo.svg" alt="" className="h-8 w-8" />
              <span className="font-sign text-xs font-black">ROUTE 66</span>
            </div>
            <div className="px-3 pb-3 pt-2">
              <div className="font-display text-4xl leading-tight">طاولة {t.label}</div>
              <div className="text-[10px] text-gray-600">{t.zone}</div>
              <img src={t.qr} alt="" className="mx-auto my-2 h-40 w-40 rounded-lg border-[3px] border-[#15170F] bg-white" />
              <div className="text-[11px] font-semibold">امسح الكود: المنيو · نادي الويتر · الحساب</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
