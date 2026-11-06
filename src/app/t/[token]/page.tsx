"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { api, deviceId } from "@/lib/client";
import { MenuBrowser, type MenuCat, type MenuItemLite } from "@/components/MenuBrowser";
import { Modal, Spinner } from "@/components/ui";

type Data = {
  table: { label: string }; restaurant: { name: string; currency: string }; qrOrdering: boolean;
  categories: MenuCat[]; openTypes: string[]; myRequests: { id: string; type: string; status: string; createdAt: string }[];
};
type CartLine = { item: MenuItemLite; qty: number; notes: string };

const REQ_LABEL: Record<string, string> = { CALL_WAITER: "نداء الويتر", BILL: "طلب الحساب", ORDER: "طلب أكل" };
const REQ_STATUS: Record<string, string> = { OPEN: "وصل للويتر", ACK: "الويتر جاي", DONE: "تم", REJECTED: "ما انقبل" };

export default function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => api<Data>(`/api/public/table/${token}?device=${deviceId()}`).then(setD).catch((e) => setErr(e.message)), [token]);
  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const send = async (type: "CALL_WAITER" | "BILL" | "ORDER") => {
    setBusy(type);
    setErr(null);
    try {
      const r = await api<{ duplicate?: boolean }>(`/api/public/table/${token}/request`, {
        body: { type, deviceId: deviceId(), items: type === "ORDER" ? cart.map((c) => ({ menuItemId: c.item.id, qty: c.qty, notes: c.notes || undefined })) : undefined },
      });
      if (type === "ORDER") { setCart([]); setCartOpen(false); }
      setFlash(r.duplicate ? "طلبك واصل من قبل، الويتر جاي" : type === "ORDER" ? "انبعت طلبك للويتر. رح يجي يأكد معك ويبعته للمطبخ" : type === "BILL" ? "الحساب جاي لعندك" : "الويتر جاي لعندك");
      setTimeout(() => setFlash(null), 4500);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = (i: MenuItemLite) => setCart((c) => {
    const x = c.find((l) => l.item.id === i.id);
    return x ? c.map((l) => (l.item.id === i.id ? { ...l, qty: Math.min(10, l.qty + 1) } : l)) : [...c, { item: i, qty: 1, notes: "" }];
  });
  const total = useMemo(() => cart.reduce((a, l) => a + l.qty * l.item.price, 0), [cart]);
  const count = cart.reduce((a, l) => a + l.qty, 0);

  if (!d) return <main className="flex min-h-screen items-center justify-center p-6 text-center text-white/60">{err ?? <Spinner />}</main>;

  const recent = d.myRequests.filter((r) => r.status !== "DONE" || Date.now() - new Date(r.createdAt).getTime() < 10 * 60000).slice(-3);

  return (
    <main className="mx-auto max-w-lg px-4 pb-32">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <img src="/img/logo.svg" alt="" className="h-10 w-10" />
          <div>
            <div className="text-xs text-white/50">أهلا فيك بـ {d.restaurant.name}</div>
            <div className="text-lg font-bold">طاولة {d.table.label}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => send("CALL_WAITER")} disabled={!!busy || d.openTypes.includes("CALL_WAITER")} className="btn-neon py-4 text-base">
          {busy === "CALL_WAITER" ? <Spinner /> : d.openTypes.includes("CALL_WAITER") ? "الويتر جاي" : "نادي الويتر"}
        </button>
        <button onClick={() => send("BILL")} disabled={!!busy || d.openTypes.includes("BILL")} className="btn-ghost py-4 text-base">
          {busy === "BILL" ? <Spinner /> : d.openTypes.includes("BILL") ? "الحساب جاي" : "بدي الحساب"}
        </button>
      </div>

      {flash && <div className="mt-3 rounded-xl bg-brand-400/20 p-3 text-center text-sm text-brand-100">{flash}</div>}
      {err && <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-center text-sm text-red-300">{err}</div>}
      {recent.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
              <span>{REQ_LABEL[r.type]}</span><span className="text-white/60">{REQ_STATUS[r.status]}</span>
            </div>
          ))}
        </div>
      )}

      <MenuBrowser categories={d.categories} currency={d.restaurant.currency} compact onAdd={d.qrOrdering ? add : undefined} qtyOf={(id) => cart.find((c) => c.item.id === id)?.qty ?? 0} />

      {d.qrOrdering && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/95 p-3 backdrop-blur">
          <button onClick={() => setCartOpen(true)} className="btn-neon mx-auto flex w-full max-w-lg justify-between py-3.5 text-base">
            <span>شوف الطلب ({count})</span>
            <span><span className="num">{total.toLocaleString("en-US")}</span> {d.restaurant.currency}</span>
          </button>
        </div>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="طلبك">
        <div className="space-y-2">
          {cart.map((l) => (
            <div key={l.item.id} className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{l.item.nameAr}</div>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost h-8 w-8 p-0" onClick={() => setCart((c) => c.flatMap((x) => (x.item.id === l.item.id ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))}>−</button>
                  <span className="num w-5 text-center">{l.qty}</span>
                  <button className="btn-ghost h-8 w-8 p-0" onClick={() => add(l.item)}>+</button>
                </div>
              </div>
              <input className="input mt-2 py-2 text-xs" placeholder="ملاحظة: بدون بصل، صوص زيادة..." value={l.notes} maxLength={120}
                onChange={(e) => setCart((c) => c.map((x) => (x.item.id === l.item.id ? { ...x, notes: e.target.value } : x)))} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-sm"><span className="text-white/60">المجموع</span><b><span className="num">{total.toLocaleString("en-US")}</span> {d.restaurant.currency}</b></div>
        <button onClick={() => send("ORDER")} disabled={!!busy} className="btn-neon mt-4 w-full py-3 text-base">{busy === "ORDER" ? <Spinner /> : "ابعت الطلب للويتر"}</button>
        <p className="mt-2 text-center text-[11px] text-white/40">الويتر بيأكد الطلب معك قبل ما يروح للمطبخ</p>
      </Modal>
    </main>
  );
}
