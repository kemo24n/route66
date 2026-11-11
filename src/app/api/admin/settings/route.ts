import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { getSettings, audit } from "@/lib/settings";

export const dynamic = "force-dynamic";
const time = z.string().regex(/^\d{2}:\d{2}$/);

const Patch = z.object({
  restaurantName: z.string().min(1).max(60), phone: z.string().max(20), whatsapp: z.string().max(20), addressAr: z.string().max(120),
  currencyLabel: z.string().max(10), taxPercent: z.number().min(0).max(50), servicePercent: z.number().min(0).max(50), usdRate: z.number().positive().max(10_000_000),
  openTime: time, closeTime: time, slotMinutes: z.number().int().min(10).max(120), bookingDurationMin: z.number().int().min(30).max(360),
  maxPartySize: z.number().int().min(1).max(60), maxDaysAhead: z.number().int().min(0).max(90), minLeadMinutes: z.number().int().min(0).max(1440),
  pendingHoldMinutes: z.number().int().min(5).max(1440), noShowGraceMinutes: z.number().int().min(0).max(180),
  riskAutoConfirmBelow: z.number().int().min(1).max(99), riskReviewAbove: z.number().int().min(1).max(99),
  bookingEnabled: z.boolean(), qrOrderingEnabled: z.boolean(),
  publicUrl: z.string().trim().max(200).transform((v) => v.replace(/\/+$/, "")).refine((v) => v === "" || /^https?:\/\/[^\s/]+/.test(v), "العنوان لازم يبلش بـ https://").nullable(),
}).partial();

export const GET = handle(async () => {
  await requirePerm(["settings", "accounting"]);
  return ok(await getSettings());
});

export const PATCH = handle(async (req: Request) => {
  const s = await requirePerm("settings");
  const b = Patch.parse(await req.json());
  const cur = await getSettings();
  // accountants may change money settings only
  if (s.role === "ACCOUNTANT") {
    const allowed = ["taxPercent", "servicePercent", "usdRate", "currencyLabel"];
    if (Object.keys(b).some((k) => !allowed.includes(k))) return fail(403, "المحاسب بيقدر يعدل الضريبة والخدمة وسعر الدولار بس");
  }
  const a = b.riskAutoConfirmBelow ?? cur.riskAutoConfirmBelow;
  const r = b.riskReviewAbove ?? cur.riskReviewAbove;
  if (a >= r) return fail(400, "حد التأكيد التلقائي لازم يكون أصغر من حد المراجعة");
  const [up] = await db.update(schema.settings).set({ ...b, updatedAt: new Date() }).where(eq(schema.settings.id, 1)).returning();
  const changed = Object.fromEntries(Object.entries(b).filter(([k, v]) => (cur as Record<string, unknown>)[k] !== v).map(([k, v]) => [k, { from: (cur as Record<string, unknown>)[k], to: v }]));
  if (Object.keys(changed).length) await audit(s.uid, "settings.update", "settings", "1", changed);
  return ok(up);
});
