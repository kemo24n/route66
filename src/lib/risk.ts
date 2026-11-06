import { db, schema } from "@/db";
import { and, eq, gte, inArray, ne, or, sql, count, countDistinct } from "drizzle-orm";
import { extractFeatures, normalizeSyPhone, scoreBooking, train, PRIOR_BIAS, PRIOR_WEIGHTS, FEATURES, type FeatureVector, type Model } from "./risk-core";
import { localParts } from "./time";
import type { Setting } from "@/db/schema";

const ACTIVE = ["PENDING", "CONFIRMED", "SEATED"] as const;

export async function getModel(): Promise<Model & { samples: number; accuracy: number | null; trainedAt: Date | null }> {
  const [m] = await db.select().from(schema.riskModel).where(eq(schema.riskModel.id, 1));
  if (!m) return { weights: { ...PRIOR_WEIGHTS }, bias: PRIOR_BIAS, samples: 0, accuracy: null, trainedAt: null };
  return { weights: m.weights, bias: m.bias, samples: m.samples, accuracy: m.accuracy, trainedAt: m.trainedAt };
}

export async function isBlocked(phone: string, ip?: string | null, deviceId?: string | null) {
  const conds = [and(eq(schema.blockEntries.type, "PHONE"), eq(schema.blockEntries.value, phone))];
  if (ip) conds.push(and(eq(schema.blockEntries.type, "IP"), eq(schema.blockEntries.value, ip)));
  if (deviceId) conds.push(and(eq(schema.blockEntries.type, "DEVICE"), eq(schema.blockEntries.value, deviceId)));
  const rows = await db.select().from(schema.blockEntries).where(or(...conds));
  const [cust] = await db.select().from(schema.customers).where(eq(schema.customers.phone, phone));
  if (cust?.blocked) return cust.blockReason || "الرقم محظور";
  return rows.length ? rows[0].reason || "محظور" : null;
}

export async function assessBooking(input: {
  name: string; phoneRaw: string; partySize: number; startAt: Date; ip?: string | null; deviceId?: string | null; elapsedMs?: number | null;
}, s: Setting) {
  const now = new Date();
  const { phone } = normalizeSyPhone(input.phoneRaw);
  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const B = schema.bookings;

  const [cust] = await db.select().from(schema.customers).where(eq(schema.customers.phone, phone));

  const [{ n: activeSamePhone }] = await db.select({ n: count() }).from(B)
    .where(and(eq(B.phone, phone), inArray(B.status, [...ACTIVE]), gte(B.endAt, now)));

  const [{ n: ipCount24h }] = input.ip
    ? await db.select({ n: count() }).from(B).where(and(eq(B.ip, input.ip), gte(B.createdAt, since)))
    : [{ n: 0 }];
  const [{ n: deviceCount24h }] = input.deviceId
    ? await db.select({ n: count() }).from(B).where(and(eq(B.deviceId, input.deviceId), gte(B.createdAt, since)))
    : [{ n: 0 }];

  // how many different phone numbers this device / IP used in the last week (including this one)
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const idConds = [];
  if (input.deviceId) idConds.push(eq(B.deviceId, input.deviceId));
  if (input.ip && input.ip !== "0.0.0.0") idConds.push(eq(B.ip, input.ip));
  let distinct = 1;
  if (idConds.length) {
    const [{ n }] = await db.select({ n: countDistinct(B.phone) }).from(B)
      .where(and(or(...idConds), gte(B.createdAt, week), ne(B.phone, phone)));
    distinct = Number(n) + 1;
  }

  // overlapping active bookings at the same time from this phone or device
  const end = new Date(input.startAt.getTime() + s.bookingDurationMin * 60000);
  const dupeConds = [eq(B.phone, phone)];
  if (input.deviceId) dupeConds.push(eq(B.deviceId, input.deviceId));
  const [{ n: sameSlotDupes }] = await db.select({ n: count() }).from(B)
    .where(and(or(...dupeConds), inArray(B.status, [...ACTIVE, "REVIEW"]), sql`${B.startAt} < ${end} and ${B.endAt} > ${input.startAt}`));

  const sp = localParts(input.startAt);
  const cp = localParts(now);
  const features = extractFeatures({
    name: input.name,
    phoneRaw: input.phoneRaw,
    partySize: input.partySize,
    startAt: input.startAt,
    now,
    localDow: sp.dow,
    localHour: sp.h,
    createdLocalHour: cp.h,
    elapsedMs: input.elapsedMs,
    history: { completed: cust?.completed ?? 0, noShows: cust?.noShows ?? 0, cancellations: cust?.cancellations ?? 0 },
    activeSamePhone: Number(activeSamePhone),
    ipCount24h: Number(ipCount24h) + 1,
    deviceCount24h: Number(deviceCount24h) + 1,
    distinctPhonesOnDeviceOrIp: distinct,
    sameSlotDupes: Number(sameSlotDupes),
  });
  const model = await getModel();
  return { phone, ...scoreBooking(features, model, { autoConfirmBelow: s.riskAutoConfirmBelow, reviewAbove: s.riskReviewAbove }) };
}

/** retrain from finished bookings: COMPLETED / SEATED = showed, NO_SHOW / staff-marked fake = 1 */
export async function retrainModel() {
  const B = schema.bookings;
  const rows = await db.select({ status: B.status, features: B.features, handledBy: B.handledBy, notes: B.notes })
    .from(B).where(inArray(B.status, ["COMPLETED", "SEATED", "NO_SHOW", "REJECTED"]));
  const samples: { f: FeatureVector; y: 0 | 1 }[] = [];
  for (const r of rows) {
    const f = r.features as FeatureVector;
    if (!f || FEATURES.some((k) => typeof f[k] !== "number")) continue;
    if (r.status === "REJECTED" && !(r.notes ?? "").includes("[fake]")) continue; // only staff-confirmed fakes
    samples.push({ f, y: r.status === "NO_SHOW" || r.status === "REJECTED" ? 1 : 0 });
  }
  const t = train(samples);
  const values = { id: 1, weights: t.weights, bias: t.bias, samples: samples.length, accuracy: t.accuracy, trainedAt: new Date() };
  await db.insert(schema.riskModel).values(values).onConflictDoUpdate({ target: schema.riskModel.id, set: values });
  return { samples: samples.length, positives: samples.filter((s) => s.y === 1).length, accuracy: t.accuracy };
}
