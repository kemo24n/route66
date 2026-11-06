import { describe, it, expect } from "vitest";
import { extractFeatures, normalizeSyPhone, phoneLooksFake, nameLooksFake, scoreBooking, train, PRIOR_WEIGHTS, PRIOR_BIAS, type RiskContext } from "../src/lib/risk-core";
import { computeTotals } from "../src/lib/money";
import { slotsForDate, businessDay, fromLocal } from "../src/lib/time";

const base = (o: Partial<RiskContext> = {}): RiskContext => ({
  name: "رامي حداد", phoneRaw: "0944123457", partySize: 2, startAt: new Date("2026-11-10T17:00:00Z"), now: new Date("2026-11-08T12:00:00Z"),
  localDow: 2, localHour: 20, createdLocalHour: 15, elapsedMs: 40000, history: { completed: 0, noShows: 0, cancellations: 0 },
  activeSamePhone: 0, ipCount24h: 1, deviceCount24h: 1, distinctPhonesOnDeviceOrIp: 1, sameSlotDupes: 0, ...o,
});
const prior = { weights: PRIOR_WEIGHTS, bias: PRIOR_BIAS };
const th = { autoConfirmBelow: 35, reviewAbove: 70 };

describe("phone + name checks", () => {
  it("normalises Syrian numbers", () => {
    expect(normalizeSyPhone("+963 944 123 457")).toEqual({ phone: "0944123457", valid: true });
    expect(normalizeSyPhone("00963944123457").phone).toBe("0944123457");
    expect(normalizeSyPhone("٠٩٤٤١٢٣٤٥٧").valid).toBe(true);
    expect(normalizeSyPhone("944123457").phone).toBe("0944123457");
    expect(normalizeSyPhone("0112233445").valid).toBe(false); // landline
    expect(normalizeSyPhone("12345").valid).toBe(false);
  });
  it("spots fake-looking numbers", () => {
    expect(phoneLooksFake("0999999999")).toBe(true);
    expect(phoneLooksFake("0912345678")).toBe(true);
    expect(phoneLooksFake("0944123457")).toBe(false);
  });
  it("spots fake names", () => {
    for (const n of ["asdfgh", "xx", "تجربة", "test", "ههههه", "a1b2"]) expect(nameLooksFake(n)).toBe(true);
    for (const n of ["رامي حداد", "Rami Haddad", "أبو علي", "Lynn"]) expect(nameLooksFake(n)).toBe(false);
  });
});

describe("scoring", () => {
  it("clean new booking is low risk", () => {
    const r = scoreBooking(extractFeatures(base()), prior, th);
    expect(r.level).toBe("LOW");
    expect(r.score).toBeLessThan(20);
  });
  it("loyal regular stays low even at peak time", () => {
    const r = scoreBooking(extractFeatures(base({ history: { completed: 6, noShows: 0, cancellations: 1 }, localDow: 5, partySize: 6 })), prior, th);
    expect(r.level).toBe("LOW");
  });
  it("past no-shows push it up", () => {
    const r = scoreBooking(extractFeatures(base({ history: { completed: 0, noShows: 3, cancellations: 0 } })), prior, th);
    expect(r.score).toBeGreaterThanOrEqual(35);
  });
  it("bot pattern is high risk with reasons", () => {
    const r = scoreBooking(extractFeatures(base({ name: "qwerty", phoneRaw: "0999999999", elapsedMs: 2000, deviceCount24h: 4, distinctPhonesOnDeviceOrIp: 3 })), prior, th);
    expect(r.level).toBe("HIGH");
    expect(r.reasons.length).toBeGreaterThan(1);
  });
  it("training learns from labelled history and stays sane", () => {
    const samples = [
      ...Array.from({ length: 80 }, () => ({ f: extractFeatures(base()), y: 0 as const })),
      ...Array.from({ length: 20 }, () => ({ f: extractFeatures(base({ elapsedMs: 3000, deviceCount24h: 3 })), y: 1 as const })),
    ];
    const t = train(samples);
    expect(t.accuracy).toBeGreaterThan(0.9);
    expect(t.weights.fast_fill).toBeGreaterThan(PRIOR_WEIGHTS.fast_fill);
  });
});

describe("money + time", () => {
  it("totals: service on discounted base, tax on top", () => {
    expect(computeTotals(10000, 1000, 10, 5)).toEqual({ subtotal: 10000, discount: 1000, serviceCharge: 900, tax: 495, total: 10395 });
    expect(computeTotals(500, 9999, 0, 0).total).toBe(0);
  });
  it("slots cross midnight and keep room for the booking duration", () => {
    const s = slotsForDate("2026-11-10", "10:00", "01:00", 30, 120);
    expect(s[0].time).toBe("10:00");
    expect(s[s.length - 1].time).toBe("23:00");
    const late = slotsForDate("2026-11-10", "18:00", "03:00", 60, 120);
    expect(late[late.length - 1].time).toBe("01:00");
    expect(late[late.length - 1].at.toISOString()).toBe("2026-11-10T22:00:00.000Z");
  });
  it("business day flips at 5am Aleppo time", () => {
    expect(businessDay(fromLocal("2026-11-11", "01:30"))).toBe("2026-11-10");
    expect(businessDay(fromLocal("2026-11-11", "06:00"))).toBe("2026-11-11");
  });
});
