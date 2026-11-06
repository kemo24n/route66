"use client";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtDateTime } from "@/lib/time";
import { PAY_LABELS } from "@/lib/money";

type Inv = {
  invoice: { number: number; subtotal: number; discount: number; serviceCharge: number; tax: number; total: number; taxPercent: number; servicePercent: number; usdRate: number; createdAt: string };
  order: { number: number; type: string; guests: number } | null; table: string | null; cashier: string | null;
  payments: { method: string; amount: number; originalAmount: number; currency: string }[];
  lines: { name: string; qty: number; unitPrice: number }[];
  restaurant: { name: string; phone: string; address: string; currency: string };
};

/** 80mm thermal receipt */
export default function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Inv | null>(null);
  useEffect(() => { api<Inv>(`/api/staff/invoices/${id}`).then((r) => { setD(r); setTimeout(() => window.print(), 400); }); }, [id]);
  if (!d) return null;
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const i = d.invoice;
  return (
    <div className="mx-auto bg-white p-3 text-black" style={{ width: "80mm", fontSize: 12 }}>
      <div className="text-center">
        <img src="/img/logo.svg" alt="" style={{ width: 54, margin: "0 auto" }} />
        <div className="mt-1 text-base font-bold">{d.restaurant.name}</div>
        <div>{d.restaurant.address}</div>
        <div className="num">{d.restaurant.phone}</div>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>فاتورة رقم</span><b className="num">{i.number}</b></div>
      <div className="flex justify-between"><span>{d.order?.type === "TAKEAWAY" ? "سفري" : `طاولة ${d.table ?? ""}`}</span><span className="num">طلب #{d.order?.number}</span></div>
      <div className="flex justify-between"><span>التاريخ</span><span className="num">{fmtDateTime(i.createdAt)}</span></div>
      {d.cashier && <div className="flex justify-between"><span>الكاشير</span><span>{d.cashier}</span></div>}
      <div className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <tbody>
          {d.lines.map((l, k) => (
            <tr key={k}>
              <td className="py-0.5">{l.name}</td>
              <td className="num px-1 text-center">{l.qty}</td>
              <td className="num text-left">{n(l.qty * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>المجموع</span><span className="num">{n(i.subtotal)}</span></div>
      {i.discount > 0 && <div className="flex justify-between"><span>خصم</span><span className="num">-{n(i.discount)}</span></div>}
      {i.serviceCharge > 0 && <div className="flex justify-between"><span>خدمة {i.servicePercent}%</span><span className="num">{n(i.serviceCharge)}</span></div>}
      {i.tax > 0 && <div className="flex justify-between"><span>ضريبة {i.taxPercent}%</span><span className="num">{n(i.tax)}</span></div>}
      <div className="mt-1 flex justify-between text-base font-bold"><span>الإجمالي</span><span className="num">{n(i.total)} {d.restaurant.currency}</span></div>
      <div className="flex justify-between text-[11px]"><span>بالدولار</span><span className="num">${(i.total / i.usdRate).toFixed(2)}</span></div>
      <div className="my-2 border-t border-dashed border-black" />
      {d.payments.map((p, k) => (
        <div key={k} className="flex justify-between text-[11px]"><span>{PAY_LABELS[p.method]}</span><span className="num">{p.currency === "USD" ? `$${p.originalAmount}` : n(p.originalAmount)}</span></div>
      ))}
      <div className="mt-3 text-center">شكراً لزيارتكم · Enjoy it your way</div>
      <div className="no-print mt-4 flex gap-2">
        <button onClick={() => window.print()} className="flex-1 rounded bg-black py-2 text-white">طباعة</button>
        <button onClick={() => window.close()} className="flex-1 rounded border border-black py-2">إغلاق</button>
      </div>
    </div>
  );
}
