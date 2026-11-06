"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, beep } from "@/lib/client";
import { ToastProvider } from "@/components/ui";
import { ROLE_LABELS, type Perm } from "@/lib/roles";

import { MeCtx, type Me } from "@/components/MeContext";

const NAV: { href: string; label: string; perm: Perm | Perm[]; owner?: boolean; icon: string }[] = [
  { href: "/staff", label: "لوحة اليوم", perm: "accounting", owner: true, icon: "◧" },
  { href: "/staff/floor", label: "الصالة", perm: "floor", icon: "▦" },
  { href: "/staff/requests", label: "النداءات", perm: "requests", icon: "◉" },
  { href: "/staff/kitchen", label: "شاشة المطبخ", perm: "kitchen", icon: "♨" },
  { href: "/staff/bookings", label: "الحجوزات", perm: "bookings", icon: "◷" },
  { href: "/staff/accounting", label: "المحاسبة", perm: ["accounting", "shifts"], icon: "¤" },
  { href: "/staff/admin/menu", label: "المنيو والأسعار", perm: "menu", icon: "☰" },
  { href: "/staff/admin/tables", label: "خريطة الطاولات", perm: "tables", icon: "⌗" },
  { href: "/staff/admin/risk", label: "كشف الحجوزات الوهمية", perm: "risk", icon: "⚑" },
  { href: "/staff/admin/users", label: "الموظفين", perm: "users", icon: "☺" },
  { href: "/staff/admin/settings", label: "الإعدادات", perm: "settings", icon: "⚙" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
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

  if (isLogin || isPrint) return <ToastProvider>{children}</ToastProvider>;

  const items = me ? NAV.filter((n) => (Array.isArray(n.perm) ? n.perm : [n.perm]).some((p) => me.perms.includes(p)) && (!n.owner || me.role === "OWNER" || me.role === "MANAGER")) : [];
  const active = (href: string) => (href === "/staff" ? path === "/staff" : path.startsWith(href));

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/staff/login";
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active(n.href) ? "bg-brand-400/20 font-semibold text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
          <span className="w-5 text-center text-base opacity-80">{n.icon}</span>
          <span className="flex-1">{n.label}</span>
          {n.href === "/staff/requests" && reqCount > 0 && <span className="chip bg-neon text-ink-900">{reqCount}</span>}
          {n.href === "/staff/bookings" && bkWaiting > 0 && <span className="chip bg-red-500 text-white">{bkWaiting}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <MeCtx.Provider value={me}>
        <div className="flex min-h-screen">
          <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l border-white/5 bg-ink-900 p-3 lg:flex">
            <div className="mb-4 flex items-center gap-2 px-2 pt-1">
              <img src="/img/logo.svg" className="h-9 w-9" alt="" />
              <div className="leading-tight"><div className="text-sm font-bold">Route 66</div><div className="text-[11px] text-white/40">نظام الإدارة</div></div>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {me && (
              <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs">
                <div className="font-semibold">{me.name}</div>
                <div className="text-white/40">{ROLE_LABELS[me.role]}</div>
                <button onClick={logout} className="mt-2 text-red-300 hover:underline">تسجيل خروج</button>
              </div>
            )}
          </aside>

          <div className="min-w-0 flex-1">
            <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-ink-900/90 px-4 py-2.5 backdrop-blur lg:hidden">
              <button onClick={() => setOpen(true)} className="btn-ghost px-3 py-2">☰ {reqCount > 0 && <span className="chip bg-neon text-ink-900">{reqCount}</span>}</button>
              <div className="text-sm font-bold">{items.find((i) => active(i.href))?.label ?? "Route 66"}</div>
              <img src="/img/logo.svg" className="h-8 w-8" alt="" />
            </div>
            {open && (
              <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
                <div className="absolute inset-y-0 right-0 w-72 overflow-y-auto bg-ink-900 p-3" onClick={(e) => e.stopPropagation()}>
                  {nav}
                  {me && <button onClick={logout} className="btn-ghost mt-4 w-full text-red-300">تسجيل خروج ({me.name})</button>}
                </div>
              </div>
            )}
            <main className="p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </MeCtx.Provider>
    </ToastProvider>
  );
}
