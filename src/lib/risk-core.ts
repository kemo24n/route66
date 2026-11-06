/**
 * Fake-booking detection: pure logic (no DB), unit-tested in tests/risk.test.ts.
 *
 * How it works
 *  1. Hard rules stop obvious abuse (blocked phone/IP/device, bot honeypot).
 *  2. Each booking is turned into a feature vector (0..1 values).
 *  3. A logistic-regression model turns the features into a probability that the
 *     booking is fake / a no-show. Score = probability * 100.
 *  4. The model starts with hand-set weights and is retrained from the restaurant's
 *     own history (who showed up and who didn't), pulled back toward the starting
 *     weights so a small history can't push it off a cliff.
 */

export const FEATURES = [
  "phone_invalid", // not a valid Syrian mobile
  "phone_pattern", // 0999999999, 0912345678 and similar
  "name_suspicious", // too short, digits, keyboard mash
  "new_customer", // never completed a booking here
  "noshow_rate", // smoothed past no-show rate for this phone
  "cancel_rate", // smoothed past cancellation rate
  "active_same_phone", // other upcoming bookings on the same phone
  "ip_burst", // bookings from the same IP in the last 24h
  "device_burst", // bookings from the same device in the last 24h
  "multi_identity", // same device/IP used with different phone numbers
  "same_slot_dupes", // more bookings at the same time from this phone/device
  "lead_short", // booked less than an hour before
  "lead_far", // booked more than a week ahead
  "party_large", // 8+ people
  "peak_slot", // Thu/Fri/Sat evening
  "night_created", // made between 2am and 7am
  "fast_fill", // form filled in under 8 seconds (bot-like)
] as const;

export type FeatureName = (typeof FEATURES)[number];
export type FeatureVector = Record<FeatureName, number>;

export const PRIOR_WEIGHTS: FeatureVector = {
  phone_invalid: 3.2,
  phone_pattern: 2.0,
  name_suspicious: 1.6,
  new_customer: 0.5,
  noshow_rate: 3.4,
  cancel_rate: 0.9,
  active_same_phone: 1.6,
  ip_burst: 1.3,
  device_burst: 1.5,
  multi_identity: 2.4,
  same_slot_dupes: 2.2,
  lead_short: 0.3,
  lead_far: 0.6,
  party_large: 0.8,
  peak_slot: 0.3,
  night_created: 0.6,
  fast_fill: 1.8,
};
export const PRIOR_BIAS = -2.6; // a clean new booking lands around 10/100

export const REASONS_AR: Record<FeatureName, string> = {
  phone_invalid: "رقم الموبايل مو رقم سوري صحيح",
  phone_pattern: "رقم الموبايل شكله وهمي (أرقام مكررة أو متسلسلة)",
  name_suspicious: "الاسم غير منطقي أو قصير كتير",
  new_customer: "زبون جديد، ما إله حجوزات سابقة حضرها",
  noshow_rate: "إله حجوزات سابقة ما حضرها",
  cancel_rate: "بيلغي حجوزاته كتير",
  active_same_phone: "عنده حجز تاني قادم بنفس الرقم",
  ip_burst: "حجوزات كتيرة من نفس الشبكة خلال 24 ساعة",
  device_burst: "حجوزات كتيرة من نفس الجهاز خلال 24 ساعة",
  multi_identity: "نفس الجهاز استخدم أرقام موبايل مختلفة",
  same_slot_dupes: "حاجز أكتر من طاولة بنفس الوقت",
  lead_short: "الحجز قبل أقل من ساعة",
  lead_far: "الحجز لأكتر من أسبوع لقدام",
  party_large: "عدد أشخاص كبير",
  peak_slot: "وقت ذروة (خميس/جمعة/سبت مسا)",
  night_created: "انعمل الحجز بنص الليل",
  fast_fill: "تعبّى الطلب بسرعة غير طبيعية (ممكن بوت)",
};

/** normalise to 09XXXXXXXX. returns null when it can't be a Syrian mobile */
export function normalizeSyPhone(raw: string): { phone: string; valid: boolean } {
  let d = (raw || "").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "");
  if (d.startsWith("00963")) d = d.slice(5);
  else if (d.startsWith("963")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("9")) d = "0" + d;
  const valid = /^09[3-9]\d{7}$/.test(d);
  return { phone: d || raw.trim(), valid };
}

export function phoneLooksFake(phone: string) {
  const tail = phone.replace(/^09/, "");
  if (/^(\d)\1{6,}$/.test(tail)) return true; // 0999999999
  if (/(\d)\1{5,}/.test(tail)) return true; // long runs
  const seqUp = "0123456789012345";
  const seqDown = "9876543210987654";
  if (seqUp.includes(tail.slice(1)) || seqDown.includes(tail.slice(1))) return true; // 0912345678
  const uniq = new Set(tail.split("")).size;
  return uniq <= 2;
}

export function nameLooksFake(name: string) {
  const n = (name || "").trim();
  if (n.length < 3) return true;
  if (/\d/.test(n)) return true;
  if (/(.)\1{3,}/u.test(n)) return true; // "ههههه", "aaaa"
  const latin = n.replace(/[^a-zA-Z]/g, "");
  if (latin.length >= 5) {
    const vowels = (latin.match(/[aeiouy]/gi) || []).length;
    if (vowels / latin.length < 0.15) return true; // "sdfgh", "qwrtz"
    if (/qwer|asdf|zxcv|wasd|hjkl/i.test(latin)) return true;
  }
  if (/test|تجربة|تست|fake|xxx/i.test(n)) return true;
  return false;
}

export type RiskContext = {
  name: string;
  phoneRaw: string;
  partySize: number;
  startAt: Date;
  now: Date;
  localDow: number; // 0 = Sunday
  localHour: number; // booking start local hour
  createdLocalHour: number;
  elapsedMs?: number | null;
  history: { completed: number; noShows: number; cancellations: number };
  activeSamePhone: number;
  ipCount24h: number;
  deviceCount24h: number;
  distinctPhonesOnDeviceOrIp: number;
  sameSlotDupes: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function extractFeatures(c: RiskContext): FeatureVector {
  const { phone, valid } = normalizeSyPhone(c.phoneRaw);
  const total = c.history.completed + c.history.noShows;
  const leadMin = (c.startAt.getTime() - c.now.getTime()) / 60000;
  const evening = c.localHour >= 19 || c.localHour < 2;
  return {
    phone_invalid: valid ? 0 : 1,
    phone_pattern: valid && phoneLooksFake(phone) ? 1 : 0,
    name_suspicious: nameLooksFake(c.name) ? 1 : 0,
    new_customer: c.history.completed === 0 ? 1 : 0,
    // Bayesian smoothing: one no-show out of one is not the same as 5 out of 5
    noshow_rate: total + c.history.noShows === 0 ? 0 : clamp01((c.history.noShows + 0) / (total + 1.5)),
    cancel_rate: clamp01(c.history.cancellations / (total + c.history.cancellations + 2)),
    active_same_phone: clamp01(c.activeSamePhone / 2),
    ip_burst: clamp01((c.ipCount24h - 1) / 4),
    device_burst: clamp01((c.deviceCount24h - 1) / 3),
    multi_identity: clamp01((c.distinctPhonesOnDeviceOrIp - 1) / 2),
    same_slot_dupes: clamp01(c.sameSlotDupes),
    lead_short: leadMin < 60 ? 1 : 0,
    lead_far: leadMin > 7 * 24 * 60 ? 1 : 0,
    party_large: c.partySize >= 8 ? clamp01((c.partySize - 6) / 6) : 0,
    peak_slot: [4, 5, 6].includes(c.localDow) && evening ? 1 : 0,
    night_created: c.createdLocalHour >= 2 && c.createdLocalHour < 7 ? 1 : 0,
    fast_fill: c.elapsedMs != null && c.elapsedMs > 0 && c.elapsedMs < 8000 ? 1 : 0,
  };
}

export type Model = { weights: Record<string, number>; bias: number };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predict(f: FeatureVector, m: Model) {
  let z = m.bias;
  for (const k of FEATURES) z += (m.weights[k] ?? PRIOR_WEIGHTS[k]) * f[k];
  return sigmoid(z);
}

export type RiskResult = { score: number; level: "LOW" | "MEDIUM" | "HIGH"; reasons: string[]; features: FeatureVector };

export function scoreBooking(f: FeatureVector, m: Model, thresholds: { autoConfirmBelow: number; reviewAbove: number }): RiskResult {
  const p = predict(f, m);
  const score = Math.round(p * 100);
  const contributions = FEATURES.map((k) => ({ k, v: (m.weights[k] ?? PRIOR_WEIGHTS[k]) * f[k] }))
    .filter((x) => x.v > 0.25)
    .sort((a, b) => b.v - a.v);
  const reasons = contributions.slice(0, 4).map((x) => REASONS_AR[x.k]);
  const level = score < thresholds.autoConfirmBelow ? "LOW" : score > thresholds.reviewAbove ? "HIGH" : "MEDIUM";
  return { score, level, reasons, features: f };
}

/**
 * Train logistic regression with gradient descent.
 * L2 pull toward the prior weights (not toward zero) keeps it stable on small data.
 * label 1 = fake / no-show, 0 = showed up.
 */
export function train(samples: { f: FeatureVector; y: 0 | 1 }[], opts: { epochs?: number; lr?: number; lambda?: number } = {}) {
  const epochs = opts.epochs ?? 400;
  const lr = opts.lr ?? 0.15;
  const lambda = opts.lambda ?? Math.max(0.02, 3 / Math.max(1, samples.length));
  const w: Record<string, number> = { ...PRIOR_WEIGHTS };
  let b = PRIOR_BIAS;
  const n = samples.length;
  if (n === 0) return { weights: w, bias: b, accuracy: null as number | null };
  // class balancing: no-shows are rarer, weight them up so the model doesn't just say "everyone shows"
  const pos = samples.filter((s) => s.y === 1).length;
  const wPos = pos > 0 ? n / (2 * pos) : 1;
  const wNeg = n - pos > 0 ? n / (2 * (n - pos)) : 1;
  for (let e = 0; e < epochs; e++) {
    const gw: Record<string, number> = Object.fromEntries(FEATURES.map((k) => [k, 0]));
    let gb = 0;
    for (const s of samples) {
      const err = (predict(s.f, { weights: w, bias: b }) - s.y) * (s.y ? wPos : wNeg);
      for (const k of FEATURES) gw[k] += err * s.f[k];
      gb += err;
    }
    for (const k of FEATURES) w[k] -= lr * (gw[k] / n + lambda * (w[k] - PRIOR_WEIGHTS[k]));
    b -= lr * (gb / n + lambda * (b - PRIOR_BIAS));
  }
  const correct = samples.filter((s) => (predict(s.f, { weights: w, bias: b }) >= 0.5 ? 1 : 0) === s.y).length;
  return { weights: w, bias: b, accuracy: correct / n };
}
