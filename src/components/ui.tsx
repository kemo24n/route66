"use client";
import { useEffect, useState, createContext, useContext, useCallback } from "react";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className={`card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="إغلاق">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white ${className}`} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">{children}</div>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-brand-300" : tone === "bad" ? "text-red-400" : tone === "warn" ? "text-neon" : "text-white";
  return (
    <div className="card p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

const RISK: Record<string, [string, string]> = {
  LOW: ["منخفض", "bg-brand-400/15 text-brand-200"],
  MEDIUM: ["متوسط", "bg-neon/15 text-neon"],
  HIGH: ["عالي", "bg-red-500/15 text-red-300"],
};
export function RiskBadge({ level, score }: { level: string; score?: number }) {
  const [l, c] = RISK[level] ?? RISK.LOW;
  return <span className={`chip ${c}`}>خطر {l}{score != null && <span className="num opacity-70">{score}</span>}</span>;
}

export const BOOKING_STATUS: Record<string, [string, string]> = {
  PENDING: ["بانتظار التأكيد", "bg-neon/15 text-neon"],
  REVIEW: ["للمراجعة", "bg-red-500/15 text-red-300"],
  CONFIRMED: ["مأكد", "bg-brand-400/20 text-brand-200"],
  SEATED: ["قاعدين", "bg-sky-500/15 text-sky-300"],
  COMPLETED: ["خلصوا", "bg-white/10 text-white/60"],
  NO_SHOW: ["ما إجوا", "bg-red-500/15 text-red-300"],
  CANCELLED: ["ملغى", "bg-white/10 text-white/50"],
  REJECTED: ["مرفوض", "bg-red-500/15 text-red-300"],
  EXPIRED: ["انتهى", "bg-white/10 text-white/50"],
};
export function StatusBadge({ status }: { status: string }) {
  const [l, c] = BOOKING_STATUS[status] ?? [status, "bg-white/10"];
  return <span className={`chip ${c}`}>{l}</span>;
}

type Toast = { id: number; text: string; tone: "ok" | "err" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {list.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl ${t.tone === "ok" ? "bg-brand-400 text-white" : "bg-red-600 text-white"}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/40">{hint}</span>}
    </label>
  );
}

export function Money({ v, cur = "ل.س" }: { v: number; cur?: string }) {
  return <span className="whitespace-nowrap"><span className="num">{Math.round(v).toLocaleString("en-US")}</span> <span className="text-[0.8em] opacity-60">{cur}</span></span>;
}
