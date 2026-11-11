"use client";
import { useEffect, useRef, useState } from "react";
import { api, useLive, beep, minutesSince } from "@/lib/client";
import { Empty, Spinner, useToast } from "@/components/ui";
import { motion, AnimatePresence } from "motion/react";

type Item = { id: string; name: string; qty: number; notes: string | null; status: string; station: string; sentAt: string; fromQr: boolean };
type Ticket = { orderId: string; number: number; type: string; table: string | null; waiter: string | null; notes: string | null; firstSentAt: string; items: Item[] };

export default function KitchenPage() {
  const toast = useToast();
  const [station, setStation] = useState<"ALL" | "KITCHEN" | "BAR">("ALL");
  const [sound, setSound] = useState(true);
  const url = `/api/staff/kitchen${station === "ALL" ? "" : `?station=${station}`}`;
  const { data, reload, connected } = useLive<{ tickets: Ticket[] }>(url, ["kitchen"], 10000);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const [, tick] = useState(0);

  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 20000); return () => clearInterval(t); }, []);
  useEffect(() => {
    try { setStation((localStorage.getItem("r66_station") as "ALL") || "ALL"); } catch {}
  }, []);

  // sound when a new item lands
  useEffect(() => {
    if (!data) return;
    const ids = data.tickets.flatMap((t) => t.items.filter((i) => i.status === "NEW").map((i) => i.id));
    const fresh = ids.filter((id) => !seen.current.has(id));
    ids.forEach((id) => seen.current.add(id));
    if (!first.current && fresh.length && sound) beep("alert");
    first.current = false;
  }, [data, sound]);

  const setSt = (s: "ALL" | "KITCHEN" | "BAR") => { setStation(s); try { localStorage.setItem("r66_station", s); } catch {} };

  const move = async (ids: string[], status: "PREPARING" | "READY" | "NEW") => {
    try {
      await api("/api/staff/kitchen", { method: "PATCH", body: { ids, status } });
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const active = (data?.tickets ?? []).filter((t) => t.items.some((i) => i.status !== "READY"));
  const done = (data?.tickets ?? []).filter((t) => t.items.every((i) => i.status === "READY"));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {([["ALL", "الكل"], ["KITCHEN", "المطبخ"], ["BAR", "البار"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSt(k)} className={`tab ${station === k ? "tab-active" : ""}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`chip ${connected ? "bg-brand-400/20 text-brand-200" : "bg-red-500/15 text-red-300"}`}>{connected ? "متصل مباشر" : "عم يعيد الاتصال"}</span>
          <button onClick={() => { setSound((s) => !s); beep(); }} className="btn-ghost py-1.5 text-xs">{sound ? "🔔 الصوت شغال" : "🔕 الصوت طافي"}</button>
        </div>
      </div>

      {!data ? <div className="py-20 text-center"><Spinner /></div> : active.length === 0 && done.length === 0 ? <Empty>ما في طلبات هلق</Empty> : (
        <>
          <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
            {active.map((t) => {
              const age = minutesSince(t.firstSentAt);
              const tone = age >= 20 ? "border-red-500 bg-red-500/5" : age >= 12 ? "border-neon/70" : "border-white/10";
              const pending = t.items.filter((i) => i.status !== "READY");
              return (
                <motion.div key={t.orderId} layout initial={{ opacity: 0, y: -30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.85, x: 80 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className={`flex flex-col overflow-hidden rounded-xl border-2 bg-road-2 ${tone}`}>
                  <div className="flex items-center justify-between border-b border-white/5 p-3">
                    <div>
                      <div className="font-display text-3xl leading-none">{t.type === "TAKEAWAY" ? "سفري" : `طاولة ${t.table}`}</div>
                      <div className="text-xs text-white/50">#{t.number}{t.waiter ? ` · ${t.waiter}` : ""}</div>
                    </div>
                    <div className={`num text-2xl font-bold ${age >= 20 ? "text-red-400" : age >= 12 ? "text-neon" : "text-white/70"}`}>{age}′</div>
                  </div>
                  <div className="flex-1 divide-y divide-white/5">
                    {t.items.map((i) => (
                      <button key={i.id} onClick={() => i.status !== "READY" && move([i.id], i.status === "NEW" ? "PREPARING" : "READY")}
                        className={`flex w-full items-start gap-3 p-3 text-right ${i.status === "READY" ? "opacity-40" : "hover:bg-white/5"}`}>
                        <span className="num min-w-[2rem] text-xl font-bold text-neon">{i.qty}×</span>
                        <span className="flex-1">
                          <span className={`block text-lg font-semibold ${i.status === "READY" ? "line-through" : ""}`}>{i.name}</span>
                          {i.notes && <span className="block rounded bg-neon/15 px-1.5 text-sm font-semibold text-neon">{i.notes}</span>}
                          <span className="mt-0.5 block text-[11px] text-white/40">{i.station === "BAR" ? "بار" : "مطبخ"}{i.fromQr ? " · QR" : ""}</span>
                        </span>
                        <span className={`chip mt-1 ${i.status === "NEW" ? "bg-white/10" : i.status === "PREPARING" ? "bg-orange-500/20 text-orange-300" : "bg-brand-400/25 text-brand-100"}`}>
                          {i.status === "NEW" ? "جديد" : i.status === "PREPARING" ? "عم ينعمل" : "جاهز"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    <button onClick={() => move(pending.filter((i) => i.status === "NEW").map((i) => i.id), "PREPARING")} disabled={!pending.some((i) => i.status === "NEW")} className="btn-ghost py-3">بلّشت</button>
                    <button onClick={() => move(pending.map((i) => i.id), "READY")} className="btn-primary py-3 text-base">جاهز ✓</button>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </motion.div>
          {done.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-sm text-white/50">جاهز ونطر الويتر</div>
              <div className="flex flex-wrap gap-2">
                {done.map((t) => (
                  <button key={t.orderId} onClick={() => move(t.items.map((i) => i.id), "PREPARING")} title="رجّعه للتحضير"
                    className="rounded-xl border border-brand-400/40 bg-brand-400/10 px-3 py-2 text-sm">
                    {t.type === "TAKEAWAY" ? "سفري" : `طاولة ${t.table}`} · #{t.number} ✓
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
