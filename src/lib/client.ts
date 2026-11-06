"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && location.pathname.startsWith("/staff")) location.href = `/staff/login?next=${encodeURIComponent(location.pathname)}`;
    throw new ApiError(res.status, data.error || "صار خطأ");
  }
  return data as T;
}

/** stable anonymous id for this browser, used by the fraud checks */
export function deviceId() {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("r66_device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("r66_device", id);
    }
    return id;
  } catch {
    return "nostorage-" + navigator.userAgent.length;
  }
}

/** load + refresh on server events (SSE) with a polling fallback */
export function useLive<T>(url: string | null, channels: string[], pollMs = 15000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;
  const reload = useCallback(async () => {
    if (!urlRef.current) return;
    try {
      setData(await api<T>(urlRef.current));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { reload(); }, [url, reload]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource(`/api/stream?channels=${channels.join(",")}`);
    const onMsg = (ev: MessageEvent) => {
      if (t) clearTimeout(t);
      t = setTimeout(reload, 150);
      try { window.dispatchEvent(new CustomEvent("r66-event", { detail: JSON.parse(ev.data) })); } catch {}
    };
    es.onmessage = onMsg;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const iv = setInterval(reload, pollMs);
    return () => { es.close(); clearInterval(iv); if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.join(","), pollMs, reload]);
  return { data, error, reload, connected, setData };
}

export function beep(kind: "new" | "alert" = "new") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = kind === "new" ? 880 : 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start(); o.stop(ctx.currentTime + 0.4);
    if (kind === "alert") setTimeout(() => beep("new"), 250);
  } catch {}
}

export function minutesSince(d: string | Date) {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
}
