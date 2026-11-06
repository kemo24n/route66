import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

export const ok = (data: unknown, init?: number) => NextResponse.json(data, { status: init ?? 200 });
export const fail = (status: number, error: string, extra?: object) => NextResponse.json({ error, ...extra }, { status });

/** wraps a route handler with consistent error output */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      if (e instanceof ZodError) return fail(400, "البيانات غير صحيحة", { issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
      console.error(e);
      return fail(500, "صار خطأ بالسيرفر، جرّب مرة تانية");
    }
  };
}

export function clientIp(req: Request) {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "0.0.0.0").slice(0, 64);
}

/** simple in-memory sliding window limiter (per server instance) */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}
