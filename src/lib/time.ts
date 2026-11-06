// Aleppo runs on UTC+3 all year. Everything the restaurant sees is in local time;
// the database stores UTC timestamps.
export const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MINUTES ?? 180);
// The business day flips at 05:00 local, so orders after midnight count for the previous day.
export const DAY_CUTOFF_HOUR = 5;

const pad = (n: number) => String(n).padStart(2, "0");

/** local wall-clock parts for a UTC date */
export function localParts(d: Date) {
  const l = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth() + 1, d: l.getUTCDate(), h: l.getUTCHours(), min: l.getUTCMinutes(), dow: l.getUTCDay() };
}

export function localDateStr(d: Date) {
  const p = localParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function localTimeStr(d: Date) {
  const p = localParts(d);
  return `${pad(p.h)}:${pad(p.min)}`;
}

/** "2026-11-07" + "21:30" (local) -> UTC Date */
export function fromLocal(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) - TZ_OFFSET_MIN * 60000);
}

export function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** business day (YYYY-MM-DD) that a moment belongs to */
export function businessDay(d: Date = new Date()) {
  return localDateStr(addMinutes(d, -DAY_CUTOFF_HOUR * 60));
}

/** UTC range [start, end) of a business day */
export function businessDayRange(day: string) {
  const start = fromLocal(day, `${pad(DAY_CUTOFF_HOUR)}:00`);
  return { start, end: addMinutes(start, 24 * 60) };
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Booking start times for a date. Handles closing after midnight (e.g. 10:00 → 01:00).
 * The last slot leaves room for the full booking duration.
 */
export function slotsForDate(date: string, openTime: string, closeTime: string, step: number, duration: number) {
  const open = toMin(openTime);
  let close = toMin(closeTime);
  if (close <= open) close += 24 * 60;
  const out: { time: string; at: Date }[] = [];
  for (let t = open; t + duration <= close; t += step) {
    const dayShift = Math.floor(t / (24 * 60));
    const mm = t % (24 * 60);
    const time = `${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`;
    out.push({ time, at: fromLocal(addDays(date, dayShift), time) });
  }
  return out;
}

export const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function arDateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${AR_DAYS[dow]} ${d}/${m}`;
}

export function fmtTime(d: Date | string) {
  return localTimeStr(new Date(d));
}

export function fmtDateTime(d: Date | string) {
  const x = new Date(d);
  return `${localDateStr(x)} ${localTimeStr(x)}`;
}
