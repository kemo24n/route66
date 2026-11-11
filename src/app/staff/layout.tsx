"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { api, beep } from "@/lib/client";
import { ToastProvider } from "@/components/ui";
import { ROLE_LABELS, type Perm } from "@/lib/roles";
import { MeCtx, type Me } from "@/components/MeContext";
import { Icon } from "@/components/Icons";

const NAV: { href: string; label: string; perm: Perm | Perm[]; owner?: boolean; icon: keyof typeof Icon; group: string }[] = [
  { href: "/staff", label: "لوحة اليوم", perm: "accounting", owner: true, icon: "dash", group: "شغل" },
  { href: "/staff/floor", label: "الصالة", perm: "floor", icon: "floor", group: "شغل" },
  { href: "/staff/requests", label: "النداءات", perm: "requests", icon: "bell", group: "شغل" },
  { href: "/staff/kitchen", label: "شاشة المطبخ", perm: "kitchen", icon: "fire", group: "شغل" },
  { href: "/staff/bookings", label: "الحجوزات", perm: "bookings", icon: "clock", group: "شغل" },
  { href: "/staff/accounting", label: "المحاسبة", perm: ["accounting", "shifts"], icon: "cash", group: "حسابات" },
  { href: "/staff/admin/menu", label: "المنيو والأسعار", perm: "menu", icon: "menu", group: "حسابات" },
  { href: "/staff/admin/tables", label: "خريطة الطاولات", perm: "tables", icon: "map", group: "إعداد" },
  { href: "/staff/admin/qr", label: "رموز QR", perm: "tables", icon: "qr", group: "إعداد" },
  { href: "/staff/admin/risk", label: "الحجوزات الوهمية", perm: "risk", icon: "shield", group: "إعداد" },
  { href: "/staff/admin/users", label: "الموظفين", perm: "users", icon: "users", group: "إعداد" },
  { href: "/staff/admin/settings", label: "الإعدادات", perm: "settings", icon: "gear", group: "إعداد" },
];

function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => {
      const d = new Date(Date.now() + 180 * 60000);
      setT(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`);
    };
    f();
    const i = setInterval(f, 10000);
    return () => clearInterval(i);
  }, []);
  return t;
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const clock = useClock();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [reqCount, setReqCount] = useState(0);
  const [bkWaiting, setBkWaiting] = useState(0);
  const isLogin = path === "/staff/login";
  const isPrint = path.startsWith("/staff/print");

  useEffect(() => {
    if (isLogin) return;
    api<Me>("/api/auth/me").then(setMe).catch(() => {});
  }, [isLogin]);

  // badge counters + sound for new waiter calls / risky bookings
  useEffect(() => {
    if (!me) return;
    const canReq = me.perms.includes("requests");
    const canBk = me.perms.includes("bookings");
    const refresh = () => {
      if (canReq) api<{ requests: unknown[] }>("/api/staff/requests").then((r) => setReqCount(r.requests.length)).catch(() => {});
      if (canBk) api<{ waiting: number }>("/api/staff/bookings").then((r) => setBkWaiting(r.waiting)).catch(() => {});
    };
    refresh();
    const ch = [canReq && "requests", canBk && "bookings"].filter(Boolean).join(",");
    if (!ch) return;
    const es = new EventSource(`/api/stream?channels=${ch}`);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data);
        if (e.channel === "requests" && e.type === "created" && !path.startsWith("/staff/kitchen")) beep("alert");
      } catch {}
      refresh();
    };
    const iv = setInterval(refresh, 30000);
    return () => { es.close(); clearInterval(iv); };
  }, [me, path]);

  useEffect(() => setOpen(false), [path]);

  if (isLogin || isPrint) return <ToastProvider>{children}</ToastProvider>;

  const items = me ? NAV.filter((n) => (Array.isArray(n.perm) ? n.perm : [n.perm]).some((p) => me.perms.includes(p)) && (!n.owner || me.role === "OWNER" || me.role === "MANAGER")) : [];
  const active = (href: string) => (href === "/staff" ? path === "/staff" : path.startsWith(href));
  const groups = [...new Set(items.map((i) => i.group))];

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/staff/login";
  };

  const badge = (href: string) =>
    href === "/staff/requests" && reqCount > 0 ? <motion.span key={reqCount} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="grid h-5 min-w-5 place-items-center rounded-md bg-line px-1 font-sign text-[11px] font-black text-coal">{reqCount}</motion.span>
    : href === "/staff/bookings" && bkWaiting > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-md bg-tail px-1 font-sign text-[11px] font-black text-white">{bkWaiting}</span> : null;

  const nav = (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-1.5 px-3 font-sign text-[10px] font-extrabold uppercase tracking-[.2em] text-white/30">{g}</div>
          <div className="space-y-0.5">
            {items.filter((i) => i.group === g).map((n) => {
              const on = active(n.href);
              return (
                <Link key={n.href} href={n.href} className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${on ? "text-white" : "text-white/55 hover:bg-white/[.04] hover:text-white"}`}>
                  {on && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-forest-sign shadow-[inset_0_0_0_2px_#1D6B3A,inset_0_0_0_3.5px_rgba(243,236,221,.85)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{Icon[n.icon]()}</span>
                  <span className="relative flex-1 font-medium">{n.label}</span>
                  <span className="relative">{badge(n.href)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <MeCtx.Provider value={me}>
        <div className="flex min-h-screen bg-[#121210]">
          <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-road-line bg-[#0d0d0c] lg:flex">
            <div className="relative overflow-hidden bg-forest px-4 pb-5 pt-4">
              <div className="dash-line absolute inset-x-0 bottom-0 h-[4px] opacity-70" style={{ backgroundSize: "60px 4px", backgroundImage: "linear-gradient(90deg,#F5C518 0 34px,transparent 34px 60px)" }} />
              <div className="flex items-center gap-3">
                <img src="/img/logo.svg" className="h-10 w-10" alt="" />
                <div className="leading-tight">
                  <div className="font-sign text-[15px] font-black text-paper">ROUTE 66</div>
                  <div className="text-[11px] text-paper/60">لوحة التشغيل</div>
                </div>
                <div className="num mr-auto rounded-md bg-black/25 px-2 py-1 font-sign text-sm font-black text-line">{clock}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">{nav}</div>
            {me && (
              <div className="m-3 flex items-center gap-3 rounded-lg border border-road-line bg-road-2 p-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-road-4 text-line">{Icon.users("h-4 w-4")}</div>
                <div className="min-w-0 flex-1 text-xs"><div className="truncate font-semibold text-white">{me.name}</div><div className="text-white/40">{ROLE_LABELS[me.role]}</div></div>
                <button onClick={logout} className="rounded-md p-2 text-white/40 hover:bg-white/5 hover:text-tail" title="تسجيل خروج">{Icon.out()}</button>
              </div>
            )}
          </aside>

          <div className="min-w-0 flex-1">
            <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-road-line bg-[#121210]/90 px-4 py-2.5 backdrop-blur lg:hidden">
              <button onClick={() => setOpen(true)} className="btn-ghost relative px-3 py-2">{Icon.burger()}{reqCount > 0 && <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-line" />}</button>
              <div className="text-sm font-bold">{items.find((i) => active(i.href))?.label ?? "Route 66"}</div>
              <span className="num font-sign text-sm font-black text-line">{clock}</span>
            </div>
            <AnimatePresence>
              {open && (
                <motion.div className="fixed inset-0 z-50 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
                  <motion.div className="absolute inset-y-0 right-0 w-72 overflow-y-auto bg-[#0d0d0c] p-3" initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} onClick={(e) => e.stopPropagation()}>
                    <div className="mb-4 flex items-center gap-2 px-2 pt-2"><img src="/img/logo.svg" className="h-9 w-9" alt="" /><span className="font-sign font-black">ROUTE 66</span></div>
                    {nav}
                    {me && <button onClick={logout} className="btn-ghost mt-6 w-full text-red-300">تسجيل خروج ({me.name})</button>}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.main key={path} className="p-4 lg:p-7" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              {children}
            </motion.main>
          </div>
        </div>
      </MeCtx.Provider>
    </ToastProvider>
  );
}
