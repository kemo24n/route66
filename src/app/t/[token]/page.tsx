"use client";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import { api, deviceId } from "@/lib/client";
import { MenuList, type MenuCat, type MenuItemLite } from "@/components/MenuList";
import { Bell, Receipt } from "@/components/Signs";

type Data = {
  table: { label: string }; restaurant: { name: string; currency: string }; qrOrdering: boolean;
  categories: MenuCat[]; openTypes: string[]; myRequests: { id: string; type: string; status: string; createdAt: string }[];
};
type CartLine = { item: MenuItemLite; qty: number; notes: string };
type Fly = { id: number; x: number; y: number; img: string | null };

const REQ_LABEL: Record<string, string> = { CALL_WAITER: "نداء الويتر", BILL: "طلب الحساب", ORDER: "طلبك" };
const REQ_STATUS: Record<string, [string, string]> = { OPEN: ["وصل", "bg-line text-coal"], ACK: ["جاي لعندك", "bg-forest text-paper"], DONE: ["تم", "bg-coal/10 text-coal"], REJECTED: ["ما انقبل", "bg-tail text-paper"] };

export default function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fly, setFly] = useState<Fly[]>([]);
  const cartBtn = useRef<HTMLButtonElement>(null);
  const bump = useAnimationControls();
  const bell = useAnimationControls();

  const load = useCallback(() => api<Data>(`/api/public/table/${token}?device=${deviceId()}`).then((r) => { setD(r); setErr(null); }).catch((e) => setErr(e.message)), [token]);
  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const say = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3800); };

  const send = async (type: "CALL_WAITER" | "BILL" | "ORDER") => {
    setBusy(type);
    setErr(null);
    if (type === "CALL_WAITER") bell.start({ rotate: [0, -18, 16, -12, 9, -5, 0], transition: { duration: 0.8 } });
    try { navigator.vibrate?.(type === "ORDER" ? [30, 40, 30] : 40); } catch {}
    try {
      const r = await api<{ duplicate?: boolean }>(`/api/public/table/${token}/request`, {
        body: { type, deviceId: deviceId(), items: type === "ORDER" ? cart.map((c) => ({ menuItemId: c.item.id, qty: c.qty, notes: c.notes || undefined })) : undefined },
      });
      if (type === "ORDER") { setCart([]); setCartOpen(false); }
      say(r.duplicate ? "طلبك واصل، الويتر جاي" : type === "ORDER" ? "وصل طلبك للويتر. رح يجي يأكد معك ويبعته للمطبخ." : type === "BILL" ? "الحساب جاي لعندك" : "الويتر جاي لعندك");
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = (i: MenuItemLite, from?: DOMRect) => {
    setCart((c) => {
      const x = c.find((l) => l.item.id === i.id);
      return x ? c.map((l) => (l.item.id === i.id ? { ...l, qty: Math.min(10, l.qty + 1) } : l)) : [...c, { item: i, qty: 1, notes: "" }];
    });
    if (from) {
      const id = Date.now() + Math.random();
      setFly((f) => [...f, { id, x: from.left + from.width / 2, y: from.top + from.height / 2, img: i.image }]);
      setTimeout(() => setFly((f) => f.filter((z) => z.id !== id)), 750);
    }
    setTimeout(() => bump.start({ scale: [1, 1.12, 0.96, 1], transition: { duration: 0.4 } }), 600);
    try { navigator.vibrate?.(12); } catch {}
  };
  const setQty = (id: string, q: number) => setCart((c) => c.flatMap((x) => (x.item.id === id ? (q > 0 ? [{ ...x, qty: Math.min(10, q) }] : []) : [x])));
  const total = useMemo(() => cart.reduce((a, l) => a + l.qty * l.item.price, 0), [cart]);
  const count = cart.reduce((a, l) => a + l.qty, 0);

  if (!d) {
    return (
      <main className="pub grain grid min-h-screen place-items-center p-6 text-center">
        {err ? <div><div className="font-display text-5xl">الكود ما اشتغل</div><p className="mt-3 text-coal-soft">{err}. اطلب من الويتر كود جديد.</p></div> : <div className="h-10 w-10 animate-spin rounded-full border-4 border-coal/20 border-t-coal" />}
      </main>
    );
  }

  const inside = Number(d.table.label) < 10;
  const recent = d.myRequests.filter((r) => r.status !== "DONE" || Date.now() - new Date(r.createdAt).getTime() < 10 * 60000).slice(-3).reverse();
  const callOpen = d.openTypes.includes("CALL_WAITER"), billOpen = d.openTypes.includes("BILL");

  return (
    <main className="pub grain pb-36">
      <header className="relative overflow-hidden bg-forest px-4 pb-8 pt-5 text-paper">
        <div className="dash-line absolute inset-x-0 bottom-0 h-[5px] opacity-80" />
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/img/logo.svg" alt="" className="h-10 w-10" />
            <div className="leading-tight"><div className="font-sign text-sm font-black">ROUTE 66</div><div className="text-[11px] opacity-70">أهلا فيك</div></div>
          </div>
          <span className="rounded-full border border-paper/30 px-3 py-1 text-xs">{inside ? "جوا بالصالة" : "برا عند المدخل"}</span>
        </div>
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120 }} className="mx-auto mt-6 flex max-w-xl items-end gap-4">
          <div className="sign-plate grid h-[92px] min-w-[92px] place-items-center px-3 font-sign text-6xl font-black">{d.table.label}</div>
          <div className="pb-1"><div className="text-sm opacity-75">إنتو قاعدين على</div><div className="font-display text-5xl leading-none">طاولة {d.table.label}</div></div>
        </motion.div>
      </header>

      <div className="mx-auto max-w-xl px-4">
        <div className="-mt-1 grid grid-cols-2 gap-3 pt-5">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("CALL_WAITER")} disabled={!!busy || callOpen}
            className={`relative overflow-hidden rounded-[16px] border-[3px] border-coal p-4 text-right shadow-hard transition disabled:opacity-100 ${callOpen ? "bg-forest text-paper" : "bg-line"}`}>
            <motion.div animate={bell} className="origin-top"><Bell className="h-10 w-10" /></motion.div>
            <div className="mt-3 font-display text-2xl leading-none">{callOpen ? "الويتر جاي" : "نادي الويتر"}</div>
            <div className="mt-1 text-xs opacity-75">{callOpen ? "ناطرين شوي" : "كبسة وحدة"}</div>
            {callOpen && <span className="absolute left-4 top-4 h-3 w-3"><span className="absolute inset-0 animate-ping rounded-full bg-line" /><span className="absolute inset-0 rounded-full bg-line" /></span>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("BILL")} disabled={!!busy || billOpen}
            className={`relative rounded-[16px] border-[3px] border-coal p-4 text-right shadow-hard ${billOpen ? "bg-coal text-paper" : "bg-[#FBF7EE]"}`}>
            <Receipt className="h-10 w-10" />
            <div className="mt-3 font-display text-2xl leading-none">{billOpen ? "الحساب جاي" : "بدي الحساب"}</div>
            <div className="mt-1 text-xs opacity-70">{billOpen ? "ثواني" : "منجيبلك ياه"}</div>
          </motion.button>
        </div>

        <AnimatePresence>
          {err && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 rounded-[12px] border-2 border-tail bg-tail/10 p-3 text-center font-semibold text-tail">{err}</motion.div>}
        </AnimatePresence>

        {recent.length > 0 && (
          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {recent.map((r) => {
                const [l, c] = REQ_STATUS[r.status];
                return (
                  <motion.div key={r.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-between rounded-[12px] border-2 border-coal/80 bg-[#FBF7EE] px-4 py-2.5 text-sm">
                    <span className="font-semibold">{REQ_LABEL[r.type]}</span>
                    <motion.span key={r.status} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className={`rounded-md px-2 py-0.5 text-xs font-bold ${c}`}>{l}</motion.span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-8">
          <div className="eyebrow text-coal-mute">{d.qrOrdering ? "اطلب من هون، الويتر بيأكد معك" : "المنيو"}</div>
          <MenuList categories={d.categories} currency={d.restaurant.currency} dense topOffset={0} onAdd={d.qrOrdering ? add : undefined} qtyOf={(id) => cart.find((c) => c.item.id === id)?.qty ?? 0} />
        </div>
      </div>

      {/* items flying to the cart */}
      {fly.map((f) => {
        const r = cartBtn.current?.getBoundingClientRect();
        return (
          <motion.div key={f.id} className="pointer-events-none fixed z-[95] h-12 w-12 overflow-hidden rounded-full border-[3px] border-coal bg-line" style={{ left: 0, top: 0 }}
            initial={{ x: f.x - 24, y: f.y - 24, scale: 1 }} animate={{ x: (r ? r.left + 30 : window.innerWidth / 2) - 24, y: (r ? r.top + r.height / 2 : window.innerHeight - 60) - 24, scale: 0.4 }}
            transition={{ duration: 0.65, ease: [0.5, 0, 0.75, 0] }}>
            {f.img && <img src={f.img} alt="" className="h-full w-full object-cover object-[50%_78%]" />}
          </motion.div>
        );
      })}

      <AnimatePresence>
        {d.qrOrdering && count > 0 && (
          <motion.div initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="fixed inset-x-0 bottom-0 z-40 p-3">
            <motion.button ref={cartBtn} animate={bump} onClick={() => setCartOpen(true)} className="pbtn-go mx-auto flex w-full max-w-xl justify-between py-4 text-lg">
              <span className="flex items-center gap-2"><span className="grid h-8 min-w-8 place-items-center rounded-full bg-coal px-2 font-sign text-sm font-black text-line">{count}</span> شوف طلبك</span>
              <span><span className="num font-sign font-black">{total.toLocaleString("en-US")}</span> <span className="text-sm">{d.restaurant.currency}</span></span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <motion.div className="fixed inset-0 z-[90] flex items-end bg-coal/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)}>
            <motion.div className="mx-auto max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-[26px] border-[3px] border-b-0 border-coal bg-paper"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => i.offset.y > 120 && setCartOpen(false)}
              onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-paper px-5 pb-3 pt-3">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-coal/25" />
                <div className="flex items-center justify-between"><h3 className="font-display text-4xl">طلبك</h3><span className="text-sm text-coal-mute">طاولة {d.table.label}</span></div>
              </div>
              <div className="space-y-3 px-5">
                <AnimatePresence initial={false}>
                  {cart.map((l) => (
                    <motion.div key={l.item.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60, height: 0 }} className="rounded-[14px] border-2 border-coal bg-[#FBF7EE] p-3">
                      <div className="flex items-center gap-3">
                        {l.item.image && <img src={l.item.image} alt="" className="h-14 w-14 rounded-[10px] border-2 border-coal object-cover object-[50%_78%]" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{l.item.nameAr}</div>
                          <div className="font-sign text-sm font-black"><span className="num">{(l.item.price * l.qty).toLocaleString("en-US")}</span></div>
                        </div>
                        <div className="flex items-center rounded-[10px] border-2 border-coal">
                          <button className="h-9 w-9 text-lg font-black" onClick={() => setQty(l.item.id, l.qty - 1)}>−</button>
                          <span className="num w-6 text-center font-sign font-black">{l.qty}</span>
                          <button className="h-9 w-9 text-lg font-black" onClick={() => setQty(l.item.id, l.qty + 1)}>+</button>
                        </div>
                      </div>
                      <input className="mt-2 w-full rounded-lg border border-coal/20 bg-paper px-3 py-2 text-sm outline-none focus:border-forest" placeholder="ملاحظة: بلا بصل، صوص زيادة..." value={l.notes} maxLength={120}
                        onChange={(e) => setCart((c) => c.map((x) => (x.item.id === l.item.id ? { ...x, notes: e.target.value } : x)))} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="sticky bottom-0 mt-4 border-t-2 border-coal/10 bg-paper p-5">
                <div className="mb-3 flex items-center justify-between"><span className="text-coal-soft">المجموع</span><b className="font-sign text-2xl font-black"><span className="num">{total.toLocaleString("en-US")}</span> <span className="text-sm">{d.restaurant.currency}</span></b></div>
                <button onClick={() => send("ORDER")} disabled={!!busy || !cart.length} className="pbtn-green w-full py-4 text-lg">{busy === "ORDER" ? "عم نبعت..." : "ابعت الطلب للويتر"}</button>
                <p className="mt-2 text-center text-xs text-coal-mute">الويتر بيأكد الطلب معك قبل ما يروح للمطبخ</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed inset-x-3 top-3 z-[100] mx-auto max-w-md rounded-[14px] border-[3px] border-coal bg-forest px-4 py-3 text-center font-semibold text-paper shadow-hard">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
