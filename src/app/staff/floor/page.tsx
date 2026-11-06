"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useLive, minutesSince } from "@/lib/client";
import { FloorMap, type MapTable } from "@/components/FloorMap";
import { Modal, Spinner, useToast, Money, RiskBadge, StatusBadge } from "@/components/ui";
import { fmtTime } from "@/lib/time";
import { useMe } from "@/components/MeContext";

type FT = MapTable & {
  order: { id: string; number: number; guests: number; createdAt: string; waiter: string | null; total: number; draft: number; cooking: number; ready: number } | null;
  booking: { id: string; name: string; partySize: number; startAt: string; status: string; riskLevel: string; code: string } | null;
  requests: { id: string; type: string; status: string; createdAt: string }[];
};
type Floor = { zones: { id: string; name: string; width: number; height: number }[]; tables: FT[]; takeaway: { id: string; number: number; total: number; createdAt: string }[] };

const REQ: Record<string, string> = { CALL_WAITER: "نداء ويتر", BILL: "بدهم الحساب", ORDER: "طلب من الموبايل" };

export default function FloorPage() {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const { data, reload } = useLive<Floor>("/api/staff/floor", ["floor", "requests", "bookings"], 20000);
  const [zone, setZone] = useState<string | null>(null);
  const [sel, setSel] = useState<FT | null>(null);
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);

  const zones = data?.zones ?? [];
  const z = zones.find((x) => x.id === (zone ?? zones[0]?.id));
  const tables = useMemo(() => (data?.tables ?? []).filter((t) => t.zoneId === z?.id), [data, z]);
  const selected = sel ? data?.tables.find((t) => t.id === sel.id) ?? sel : null;
  const stats = useMemo(() => {
    const all = data?.tables ?? [];
    return { busy: all.filter((t) => t.order).length, total: all.length, calls: all.reduce((a, t) => a + t.requests.length, 0), ready: all.reduce((a, t) => a + (t.order?.ready ?? 0), 0) };
  }, [data]);

  const openOrder = async (t: FT) => {
    if (t.order) return router.push(`/staff/pos/${t.order.id}`);
    setBusy(true);
    try {
      const r = await api<{ id: string; seatedBooking?: string }>("/api/staff/orders", { body: { tableId: t.id, type: "DINE_IN", guests } });
      if (r.seatedBooking) toast("انربط الطلب بالحجز وصار الزبون قاعد");
      router.push(`/staff/pos/${r.id}`);
    } catch (e) {
      toast((e as Error).message, "err");
      setBusy(false);
    }
  };

  const takeaway = async () => {
    const r = await api<{ id: string }>("/api/staff/orders", { body: { type: "TAKEAWAY", guests: 1 } });
    router.push(`/staff/pos/${r.id}`);
  };

  const reqAction = async (id: string, action: string) => {
    try {
      const r = await api<{ orderId?: string }>(`/api/staff/requests/${id}`, { method: "PATCH", body: { action } });
      toast(action === "accept" ? "انبعت الطلب للمطبخ" : "تم");
      reload();
      if (r.orderId && action === "accept") setSel(null);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  if (!data) return <div className="py-20 text-center"><Spinner /></div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {zones.map((x) => (
            <button key={x.id} onClick={() => setZone(x.id)} className={`tab ${z?.id === x.id ? "tab-active" : ""}`}>{x.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="chip bg-white/10">مشغولة <span className="num">{stats.busy}/{stats.total}</span></span>
          {stats.calls > 0 && <span className="chip bg-neon text-ink-900">نداءات {stats.calls}</span>}
          {stats.ready > 0 && <span className="chip bg-brand-400 text-white">جاهز للتقديم {stats.ready}</span>}
          {me?.perms.includes("pos") && <button onClick={takeaway} className="btn-ghost py-2">+ طلب سفري</button>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="card p-3">
          {z && (
            <FloorMap width={z.width} height={z.height} tables={tables} selectedId={selected?.id} onSelect={(t) => { setSel(t as FT); setGuests((t as FT).booking?.partySize ?? Math.min(4, t.seats)); }}
              look={(t) => {
                const x = t as FT;
                const call = x.requests.length > 0;
                const soon = x.booking && new Date(x.booking.startAt).getTime() - Date.now() < 60 * 60000;
                if (x.order) {
                  return {
                    fill: x.order.ready ? "#1f4f2a" : "#4a3b12", stroke: x.order.ready ? "#76b783" : "#F2C14E", text: "#fff",
                    sub: `${x.order.total.toLocaleString("en-US")}`,
                    badge: call ? "!" : x.order.ready ? `${x.order.ready}✓` : x.order.draft ? "✎" : undefined,
                    badgeColor: call ? "#F2C14E" : x.order.ready ? "#76b783" : "#94a3b8", pulse: call || x.order.ready > 0,
                  };
                }
                if (call) return { fill: "#1d4a25", stroke: "#F2C14E", badge: "!", pulse: true };
                if (x.booking && soon) return { fill: "#16324a", stroke: "#60a5fa", sub: `حجز ${fmtTime(x.booking.startAt)}`, badge: x.booking.riskLevel === "HIGH" ? "⚑" : undefined, badgeColor: "#f87171" };
                if (x.booking) return { fill: "#17261a", stroke: "#3b6ea5", sub: `حجز ${fmtTime(x.booking.startAt)}` };
                return { fill: "#17261a", stroke: "#334436" };
              }} />
          )}
          <div className="mt-2 flex flex-wrap gap-3 px-1 text-[11px] text-white/45">
            <span>■ <span className="text-[#F2C14E]">عليها طلب</span></span>
            <span>■ <span className="text-brand-300">في أكل جاهز</span></span>
            <span>■ <span className="text-sky-400">محجوزة قريباً</span></span>
            <span>! نداء من الطاولة</span>
          </div>
        </div>

        <div className="space-y-3">
          {data.takeaway.length > 0 && (
            <div className="card p-3">
              <div className="mb-2 text-sm font-semibold">طلبات سفري مفتوحة</div>
              {data.takeaway.map((o) => (
                <button key={o.id} onClick={() => router.push(`/staff/pos/${o.id}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-white/5">
                  <span>#{o.number}</span><Money v={o.total} />
                </button>
              ))}
            </div>
          )}
          <div className="card p-3">
            <div className="mb-2 text-sm font-semibold">حجوزات جاية</div>
            {data.tables.filter((t) => t.booking).sort((a, b) => +new Date(a.booking!.startAt) - +new Date(b.booking!.startAt)).slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-white/5 py-2 text-xs last:border-0">
                <span><b className="num">{fmtTime(t.booking!.startAt)}</b> · طاولة {t.label}</span>
                <span className="text-white/60">{t.booking!.name} ({t.booking!.partySize})</span>
              </div>
            ))}
            {!data.tables.some((t) => t.booking) && <div className="py-3 text-center text-xs text-white/40">ما في حجوزات بالساعات الجاية</div>}
          </div>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSel(null)} title={selected ? `طاولة ${selected.label} · ${selected.seats} أشخاص` : ""}>
        {selected && (
          <div className="space-y-4">
            {selected.requests.length > 0 && (
              <div className="space-y-2">
                {selected.requests.map((r) => (
                  <div key={r.id} className="rounded-xl bg-neon/10 p-3">
                    <div className="flex items-center justify-between text-sm"><b className="text-neon">{REQ[r.type]}</b><span className="text-xs text-white/50">قبل {minutesSince(r.createdAt)} د</span></div>
                    <div className="mt-2 flex gap-2">
                      {r.type === "ORDER" ? (
                        <button onClick={() => router.push("/staff/requests")} className="btn-primary flex-1 py-2">شوف الطلب</button>
                      ) : (
                        <>
                          {r.status === "OPEN" && <button onClick={() => reqAction(r.id, "ack")} className="btn-ghost flex-1 py-2">رايح</button>}
                          <button onClick={() => reqAction(r.id, "done")} className="btn-primary flex-1 py-2">تم</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected.booking && (
              <div className="rounded-xl bg-sky-500/10 p-3 text-sm">
                <div className="flex items-center justify-between"><b>حجز {fmtTime(selected.booking.startAt)}</b><StatusBadge status={selected.booking.status} /></div>
                <div className="mt-1 text-white/70">{selected.booking.name} · {selected.booking.partySize} أشخاص · <span className="num">{selected.booking.code}</span></div>
                <div className="mt-1"><RiskBadge level={selected.booking.riskLevel} /></div>
              </div>
            )}

            {selected.order ? (
              <div className="rounded-xl bg-white/5 p-3 text-sm">
                <div className="flex justify-between"><span>طلب #{selected.order.number}</span><Money v={selected.order.total} /></div>
                <div className="mt-1 text-xs text-white/50">
                  من {minutesSince(selected.order.createdAt)} دقيقة · {selected.order.guests} أشخاص{selected.order.waiter ? ` · ${selected.order.waiter}` : ""}
                </div>
                <div className="mt-2 flex gap-2 text-[11px]">
                  {selected.order.cooking > 0 && <span className="chip bg-neon/15 text-neon">عم ينطبخ {selected.order.cooking}</span>}
                  {selected.order.ready > 0 && <span className="chip bg-brand-400/20 text-brand-200">جاهز {selected.order.ready}</span>}
                  {selected.order.draft > 0 && <span className="chip bg-white/10">ما انبعت {selected.order.draft}</span>}
                </div>
              </div>
            ) : me?.perms.includes("pos") && (
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                <span className="text-sm">عدد الأشخاص</span>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost h-9 w-9 p-0" onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
                  <span className="num w-6 text-center font-bold">{guests}</span>
                  <button className="btn-ghost h-9 w-9 p-0" onClick={() => setGuests((g) => g + 1)}>+</button>
                </div>
              </div>
            )}
            {me?.perms.includes("pos") && (
              <button onClick={() => openOrder(selected)} disabled={busy} className="btn-neon w-full py-3 text-base">
                {busy ? <Spinner /> : selected.order ? "فتح الطلب" : "فتح طلب جديد"}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
