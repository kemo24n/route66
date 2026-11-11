"use client";
import { useEffect, useState } from "react";
import { api, useLive, minutesSince } from "@/lib/client";
import { Empty, Money, Spinner, useToast } from "@/components/ui";
import { motion, AnimatePresence } from "motion/react";

type R = { id: string; type: string; status: string; createdAt: string; table: string; tableId: string; note: string | null; items: { menuItemId: string; qty: number; notes?: string; name: string; price: number }[] };

const LABEL: Record<string, [string, string]> = {
  CALL_WAITER: ["نداء ويتر", "bg-neon text-ink-900"],
  BILL: ["طلب الحساب", "bg-sky-400 text-ink-900"],
  ORDER: ["طلب من الموبايل", "bg-brand-400 text-white"],
};

export default function RequestsPage() {
  const toast = useToast();
  const { data, reload } = useLive<{ requests: R[] }>("/api/staff/requests", ["requests"], 10000);
  const [busy, setBusy] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api(`/api/staff/requests/${id}`, { method: "PATCH", body: { action } });
      toast(action === "accept" ? "انضاف الطلب عالطاولة وانبعت للمطبخ" : action === "reject" ? "انرفض الطلب" : "تم");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <div className="py-20 text-center"><Spinner /></div>;
  return (
    <div>
      <h1 className="mb-5 font-display text-4xl leading-none">النداءات من الطاولات</h1>
      {data.requests.length === 0 ? <Empty>ما في نداءات هلق</Empty> : (
        <motion.div layout className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
          {data.requests.map((r) => {
            const [l, c] = LABEL[r.type];
            const late = minutesSince(r.createdAt) >= 3;
            return (
              <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.9, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, x: 60 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} className={`card p-4 ${late ? "border-tail shadow-[0_0_0_1px_#D9381E]" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="font-display text-4xl leading-none">طاولة {r.table}</div>
                  <span className={`chip ${c}`}>{l}</span>
                </div>
                <div className={`mt-1 text-xs ${late ? "text-red-300" : "text-white/50"}`}>قبل {minutesSince(r.createdAt)} دقيقة {r.status === "ACK" && "· حدا رايح"}</div>
                {r.type === "ORDER" && (
                  <div className="mt-3 space-y-1 rounded-xl bg-white/5 p-3 text-sm">
                    {r.items.map((i, k) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span><b className="num">{i.qty}×</b> {i.name}{i.notes && <span className="block text-xs text-neon">{i.notes}</span>}</span>
                        <Money v={i.qty * i.price} />
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-white/10 pt-1.5 font-bold"><span>المجموع</span><Money v={r.items.reduce((a, i) => a + i.qty * i.price, 0)} /></div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {r.type === "ORDER" ? (
                    <>
                      <button disabled={!!busy} onClick={() => act(r.id, "accept")} className="btn-primary flex-1">تأكدت، ابعت للمطبخ</button>
                      <button disabled={!!busy} onClick={() => act(r.id, "reject")} className="btn-ghost text-red-300">وهمي</button>
                    </>
                  ) : (
                    <>
                      {r.status === "OPEN" && <button disabled={!!busy} onClick={() => act(r.id, "ack")} className="btn-ghost flex-1">رايح</button>}
                      <button disabled={!!busy} onClick={() => act(r.id, "done")} className="btn-primary flex-1">تم</button>
                      <button disabled={!!busy} onClick={() => act(r.id, "reject")} className="btn-ghost text-red-300" title="ما حدا قاعد عالطاولة">✕</button>
                    </>
                  )}
                </div>
                {r.type === "ORDER" && <p className="mt-2 text-[11px] text-white/40">روح عالطاولة وتأكد إنو في حدا قاعد قبل ما تقبل الطلب</p>}
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
