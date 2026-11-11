"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { PublicHeader } from "@/components/PublicShell";
import { BookingMap } from "@/components/BookingMap";
import type { MapTable } from "@/components/FloorMap";
import { api, deviceId } from "@/lib/client";
import { AR_DAYS } from "@/lib/time";
import { Car, Arrow, Shield } from "@/components/Signs";
import { SignWords } from "@/components/motion";

type Slot = { time: string; available: boolean; freeTables: number; fill?: number; past?: boolean };
type T = MapTable & { state: "free" | "busy" | "small" | "closed"; fit: boolean };
type Info = { openTime: string; closeTime: string; phone: string; address: string; durationMin: number };

const MONTHS = ["كانون التاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين التاني", "كانون الأول"];
const STOPS = ["الوقت", "الطاولة", "الاسم"];
const NOTE_CHIPS = ["عيد ميلاد", "كرسي أطفال", "قريب عالشاشة", "بعيد عن الدخان"];

function dParts(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return { dow: AR_DAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()], day, month: MONTHS[m - 1] };
}
const period = (t: string) => { const h = Number(t.slice(0, 2)); return h < 5 ? "سهرة" : h < 17 ? "غدا" : h < 22 ? "عشا" : "سهرة"; };

export default function BookPage() {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [party, setParty] = useState(2);
  const [maxParty, setMaxParty] = useState(12);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [tables, setTables] = useState<T[] | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [alt, setAlt] = useState<{ label: string; times: string[] } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSlots(null);
    api<{ enabled: boolean; dates: string[]; date: string; slots: Slot[]; maxParty: number; info?: Info }>(`/api/public/slots?party=${party}${date ? `&date=${date}` : ""}`)
      .then((r) => {
        setEnabled(r.enabled);
        setDates(r.dates);
        if (!date) setDate(r.date);
        setSlots(r.slots);
        if (r.maxParty) setMaxParty(r.maxParty);
        if (r.info) setInfo(r.info);
        setTime((t) => (t && r.slots.some((s) => s.time === t && s.available) ? t : null));
      })
      .catch((e) => setErr(e.message));
  }, [party, date]);

  useEffect(() => {
    setTableId(null);
    setAlt(null);
    if (!date || !time) return setTables(null);
    setTables(null);
    api<{ tables: T[] }>(`/api/public/availability?date=${date}&time=${time}&party=${party}`).then((r) => setTables(r.tables)).catch((e) => setErr(e.message));
  }, [date, time, party]);

  const selected = tables?.find((t) => t.id === tableId) ?? null;
  const freeTables = useMemo(() => (tables ?? []).filter((t) => t.state === "free").sort((a, b) => Number(b.fit) - Number(a.fit) || a.seats - b.seats), [tables]);
  const grouped = useMemo(() => {
    const g: Record<string, Slot[]> = {};
    (slots ?? []).filter((s) => !s.past).forEach((s) => (g[period(s.time)] ??= []).push(s));
    return Object.entries(g);
  }, [slots]);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); setErr(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const pick = (t: MapTable) => {
    const x = tables?.find((y) => y.id === t.id);
    if (!x) return;
    if (x.state === "busy" && date) {
      setTableId(null);
      api<{ times: string[] }>(`/api/public/table-times?date=${date}&tableId=${x.id}`).then((r) => setAlt({ label: x.label, times: r.times.filter((v) => v !== time) })).catch(() => {});
      return;
    }
    if (x.state !== "free") return;
    setAlt(null);
    setTableId(x.id);
  };

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !phone.trim()) return setErr("اكتب الاسم ورقم الموبايل");
    setBusy(true);
    try {
      const r = await api<{ code: string }>("/api/public/bookings", {
        body: { name, phone, partySize: party, date, time, tableId, notes: notes || undefined, deviceId: deviceId(), elapsedMs: Date.now() - startedAt.current, website: hp },
      });
      router.push(`/book/${r.code}?new=1`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const dateLabel = date ? (() => { const p = dParts(date); return `${p.dow} ${p.day} ${p.month}`; })() : "—";

  return (
    <div className="pub grain">
      <PublicHeader openTime={info?.openTime} closeTime={info?.closeTime} phone={info?.phone} />
      <main className="mx-auto max-w-7xl px-4 pb-32 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
          <h1 className="font-display text-[clamp(56px,10vw,112px)] leading-[.85]"><SignWords text="احجز طاولة" /></h1>
          <Progress step={step} onJump={(n) => n < step && go(n)} />
        </div>

        {!enabled && <div className="mt-8 rounded-[14px] border-[3px] border-coal bg-line p-5 font-semibold shadow-hard">الحجز أونلاين موقف هلق. اتصل فينا على <a className="num underline" href={`tel:${info?.phone}`}>{info?.phone}</a> ومنحجزلك.</div>}

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative min-h-[520px]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={step} custom={dir}
                initial={{ opacity: 0, x: dir * -60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * 60 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                {step === 0 && (
                  <div className="space-y-10">
                    <Block n="01" title="كم واحد جايين؟">
                      <div className="flex flex-wrap items-center gap-5">
                        <div className="flex items-center rounded-[14px] border-[3px] border-coal bg-[#FBF7EE] shadow-hard">
                          <button className="h-16 w-16 text-3xl font-black disabled:opacity-30" disabled={party <= 1} onClick={() => setParty((p) => Math.max(1, p - 1))} aria-label="أقل">−</button>
                          <div className="relative h-16 w-20 overflow-hidden border-x-[3px] border-coal">
                            <motion.div key={party} className="flex h-full w-full items-center justify-center pt-1 font-sign text-4xl font-black leading-none" initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}>
                              <span dir="ltr" className="tabular-nums">{party}</span>
                            </motion.div>
                          </div>
                          <button className="h-16 w-16 text-3xl font-black disabled:opacity-30" disabled={party >= maxParty} onClick={() => setParty((p) => Math.min(maxParty, p + 1))} aria-label="أكتر">+</button>
                        </div>
                        <div className="flex gap-2">
                          {[2, 4, 6, 8].filter((n) => n <= maxParty).map((n) => (
                            <button key={n} onClick={() => setParty(n)} className={`num h-12 w-12 rounded-full border-2 border-coal font-sign text-lg font-black transition ${party === n ? "bg-coal text-paper" : "hover:bg-paper-2"}`}>{n}</button>
                          ))}
                        </div>
                        <span className="text-sm text-coal-mute">أكتر من {maxParty}؟ اتصل فينا</span>
                      </div>
                    </Block>

                    <Block n="02" title="أي يوم؟">
                      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 sm:mx-0 sm:px-0">
                        {dates.map((d, i) => {
                          const p = dParts(d);
                          const on = date === d;
                          return (
                            <motion.button key={d} onClick={() => setDate(d)} whileTap={{ scale: 0.95 }} animate={{ y: on ? -4 : 0, rotate: on ? -2 : 0 }}
                              className={`relative w-[86px] shrink-0 overflow-hidden rounded-[12px] border-[3px] border-coal text-center transition-colors ${on ? "bg-forest text-paper shadow-hard" : "bg-[#FBF7EE] shadow-hard-sm hover:bg-paper-2"}`}>
                              <div className={`py-1 text-[11px] font-bold ${on ? "bg-line text-coal" : "bg-tail text-paper"}`}>{i === 0 ? "اليوم" : i === 1 ? "بكرا" : p.dow}</div>
                              <div className="num font-sign text-4xl font-black leading-[1.15]">{p.day}</div>
                              <div className="pb-2 text-[11px] opacity-70">{p.month}</div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </Block>

                    <Block n="03" title="الساعة كم؟">
                      {!slots ? <SlotSkeleton /> : slots.length === 0 || !slots.some((s) => s.available) ? (
                        <div className="rounded-[12px] border-2 border-dashed border-coal/40 p-6 text-center text-coal-soft">ما ضل أوقات بهاليوم لعددكم. جرّب يوم تاني.</div>
                      ) : (
                        <div className="space-y-5">
                          {grouped.map(([g, list]) => (
                            <div key={g}>
                              <div className="eyebrow mb-2 text-coal-mute">{g}</div>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                                {list.map((s) => {
                                  const on = time === s.time;
                                  const hot = s.available && (s.fill ?? 0) >= 70;
                                  return (
                                    <motion.button key={s.time} disabled={!s.available} onClick={() => setTime(s.time)} whileTap={{ scale: 0.94 }}
                                      className={`relative overflow-hidden rounded-[10px] border-2 py-2.5 text-center transition ${on ? "border-coal bg-line shadow-hard-sm" : s.available ? "border-coal/70 bg-[#FBF7EE] hover:border-coal" : "border-coal/15 text-coal/25"}`}>
                                      <span className={`num font-sign text-lg font-black ${!s.available ? "line-through" : ""}`}>{s.time}</span>
                                      {hot && <span className="block text-[10px] font-bold text-tail">قرّبت تخلص</span>}
                                      {s.available && <i className="absolute inset-x-0 bottom-0 h-[4px] origin-right bg-coal/15"><i className="block h-full bg-tail/70" style={{ width: `${s.fill ?? 0}%` }} /></i>}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Block>
                    <NextBar disabled={!time} onNext={() => go(1)} label="اختار الطاولة" />
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <Block n="04" title="وين بدك تقعد؟">
                      <p className="-mt-2 mb-4 text-coal-soft">جوا بالصالة أو برا عند المدخل. كبسة على أي طاولة خضرا. الطاولة يلي عليها نجمة هي الأنسب لـ {party} أشخاص.</p>
                      <div className="overflow-hidden rounded-[18px] border-[3px] border-coal bg-[#080e0a] shadow-hard">
                        <div className="scrollbar-none overflow-x-auto">
                          <div className="min-w-[680px]">
                            {tables ? <BookingMap tables={tables} selectedId={tableId} onSelect={pick} /> : <div className="aspect-[1130/730] animate-pulse bg-road-3" />}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 border-t-2 border-paper/10 bg-road px-4 py-3 text-xs text-paper/75">
                          <Legend c="#4fd172" l="فاضية" /><Legend c="#F2C14E" l="★ الأنسب إلكم" /><Legend c="#ff3b30" l="محجوزة (كبسة لتشوف أوقاتها)" />
                          <span className="mr-auto sm:hidden">← اسحب لتشوف كل المحل</span>
                        </div>
                      </div>
                    </Block>

                    <AnimatePresence>
                      {alt && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-4 rounded-[14px] border-[3px] border-coal bg-line p-4 shadow-hard-sm">
                            <div className="font-semibold">طاولة {alt.label} محجوزة الساعة <span className="num">{time}</span>. {alt.times.length ? "فاضية بهالأوقات:" : "ما في وقت فاضي عليها بهاليوم."}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {alt.times.slice(0, 10).map((v) => <button key={v} onClick={() => setTime(v)} className="num rounded-lg border-2 border-coal bg-paper px-3 py-1.5 font-sign font-black hover:bg-coal hover:text-paper">{v}</button>)}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {tables && (
                      <div className="mt-6">
                        <div className="eyebrow mb-3 text-coal-mute">أو اختار من القائمة · {freeTables.length} فاضية</div>
                        <div className="flex flex-wrap gap-2">
                          {freeTables.map((t) => (
                            <button key={t.id} onClick={() => pick(t)} className={`flex items-center gap-2 rounded-[10px] border-2 border-coal px-3 py-2 transition ${tableId === t.id ? "bg-forest text-paper shadow-hard-sm" : "bg-[#FBF7EE] hover:bg-paper-2"}`}>
                              <span className="font-sign text-lg font-black">{t.label}</span>
                              <span className="text-xs opacity-75">{t.seats} كراسي{Number(t.label) >= 10 ? " · برا" : " · جوا"}</span>
                              {t.fit && <span className="text-line">★</span>}
                            </button>
                          ))}
                          {!freeTables.length && <div className="text-coal-soft">كل الطاولات محجوزة بهالوقت. ارجع واختار ساعة تانية.</div>}
                        </div>
                      </div>
                    )}
                    <NextBar back={() => go(0)} disabled={!tableId} onNext={() => go(2)} label="آخر خطوة" />
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <Block n="05" title="على اسم مين؟">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block"><span className="mb-1.5 block text-sm font-semibold">الاسم</span><input className="pinput" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="الاسم الكامل" /></label>
                        <label className="block"><span className="mb-1.5 block text-sm font-semibold">رقم الموبايل</span><input className="pinput num w-full text-left font-sign text-lg" inputMode="tel" placeholder="09xx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
                      </div>
                      <div className="mt-5">
                        <span className="mb-1.5 block text-sm font-semibold">بدك نجهزلكم شي؟ <span className="font-normal text-coal-mute">(اختياري)</span></span>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {NOTE_CHIPS.map((c) => {
                            const on = notes.includes(c);
                            return <button key={c} onClick={() => setNotes((n) => on ? n.replace(c, "").replace(/^[،\s]+|[،\s]+$/g, "").replace(/،\s*،/g, "،") : n ? `${n}، ${c}` : c)} className={`rounded-full border-2 border-coal px-3 py-1.5 text-sm transition ${on ? "bg-coal text-paper" : "hover:bg-paper-2"}`}>{on ? "✓ " : "+ "}{c}</button>;
                          })}
                        </div>
                        <input className="pinput" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أو اكتب ملاحظتك" maxLength={300} />
                      </div>
                      {/* bots fill every field; people never see this one */}
                      <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
                    </Block>
                    <AnimatePresence>{err && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }} className="mt-4 rounded-[12px] border-2 border-tail bg-tail/10 p-3 font-semibold text-tail">{err}</motion.div>}</AnimatePresence>
                    <NextBar back={() => go(1)} disabled={busy || !name.trim() || phone.trim().length < 9} onNext={submit} label={busy ? "عم نثبّت..." : "ثبّت الحجز"} final />
                    <p className="mt-3 text-sm text-coal-mute">الطاولة إلكم {info ? Math.round(info.durationMin / 60) : 2} ساعات من وقت الحجز. إذا تأخرتوا أكتر من 20 دقيقة ممكن تنعطى لغيركم.</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <TicketPreview party={party} date={dateLabel} time={time} table={selected} name={name} />
        </div>
      </main>
    </div>
  );
}

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-coal pt-[2px] font-sign text-sm font-black leading-none text-paper">{n}</span>
        <h2 className="font-display text-4xl leading-none md:text-5xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />{l}</span>;
}

function SlotSkeleton() {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 animate-pulse rounded-[10px] bg-coal/10" style={{ animationDelay: `${i * 60}ms` }} />)}</div>;
}

function NextBar({ onNext, back, disabled, label, final }: { onNext: () => void; back?: () => void; disabled?: boolean; label: string; final?: boolean }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-10 flex items-center gap-3 border-t-2 border-coal/10 bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      {back && <button onClick={back} className="pbtn-plain px-4">رجوع</button>}
      <button onClick={onNext} disabled={disabled} className={`${final ? "pbtn-green" : "pbtn-go"} flex-1 py-4 text-lg sm:flex-none sm:px-10`}>{label} <Arrow className="h-5 w-5" /></button>
    </div>
  );
}

/** road progress: the car drives to the current stop */
function Progress({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <div className="w-full max-w-md">
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-coal" />
        <div className="dash-line absolute inset-x-2 top-1/2 h-[3px] -translate-y-1/2 opacity-80" style={{ backgroundSize: "26px 3px", backgroundImage: "linear-gradient(90deg,#F5C518 0 14px,transparent 14px 26px)" }} />
        {STOPS.map((s, i) => {
          const pos = `${(i / (STOPS.length - 1)) * 100}%`;
          return (
            <button key={s} onClick={() => onJump(i)} className="absolute top-1/2 -translate-y-1/2 translate-x-1/2" style={{ right: pos }}>
              <span className={`block h-5 w-5 rounded-full border-[3px] border-coal ${i <= step ? "bg-line" : "bg-paper"}`} />
            </button>
          );
        })}
        <motion.div className="absolute -top-1" animate={{ right: `calc(${(step / (STOPS.length - 1)) * 100}% - 30px)` }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
          <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.5 }}><Car className="h-8 w-16 -scale-x-100" /></motion.div>
        </motion.div>
      </div>
      <div className="flex justify-between text-xs font-semibold">
        {STOPS.map((s, i) => <span key={s} className={i <= step ? "text-coal" : "text-coal-mute"}>{s}</span>)}
      </div>
    </div>
  );
}

/** ticket that fills in as the guest chooses */
function TicketPreview({ party, date, time, table, name }: { party: number; date: string; time: string | null; table: T | null; name: string }) {
  const rows: [string, React.ReactNode, string][] = [
    ["الأشخاص", <span key="p" className="num">{party}</span>, `p${party}`],
    ["اليوم", date, `d${date}`],
    ["الساعة", time ? <span key="t" className="num">{time}</span> : "—", `t${time}`],
    ["الطاولة", table ? `${table.label} · ${table.seats} كراسي` : "—", `b${table?.id}`],
    ["الاسم", name || "—", "n"],
  ];
  return (
    <aside className="sticky top-24 hidden lg:block">
      <motion.div initial={{ rotate: 3, y: 30, opacity: 0 }} animate={{ rotate: -1.5, y: 0, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 120 }}
        className="relative overflow-hidden rounded-[16px] border-[3px] border-coal bg-[#FBF7EE] shadow-hard">
        <div className="flex items-center justify-between bg-forest px-5 py-4 text-paper">
          <div>
            <div className="font-sign text-lg font-black tracking-tight">ROUTE 66</div>
            <div className="text-[11px] opacity-70">تذكرة حجز</div>
          </div>
          <Shield n="66" className="h-11 w-10" fill="#F3ECDD" />
        </div>
        <div className="space-y-0 px-5 py-3">
          {rows.map(([k, v, key]) => (
            <div key={k} className="flex items-center justify-between border-b border-dashed border-coal/20 py-2.5 text-sm last:border-0">
              <span className="text-coal-mute">{k}</span>
              <AnimatePresence mode="wait"><motion.span key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="font-semibold">{v}</motion.span></AnimatePresence>
            </div>
          ))}
        </div>
        <div className="relative h-6 text-paper-3">
          <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-coal/30" />
          <span className="absolute -right-4 top-0 h-6 w-8 rounded-full border-[3px] border-coal bg-paper" />
          <span className="absolute -left-4 top-0 h-6 w-8 rounded-full border-[3px] border-coal bg-paper" />
        </div>
        <div className="flex items-center justify-between px-5 pb-4 pt-1">
          <div className="text-[11px] text-coal-mute">رقم الحجز بيطلع<br />بعد التثبيت</div>
          <Barcode />
        </div>
      </motion.div>
    </aside>
  );
}

function Barcode() {
  const bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1];
  return <div className="flex h-10 items-stretch gap-[2px] opacity-80">{bars.map((w, i) => <i key={i} className="bg-coal" style={{ width: w }} />)}</div>;
}
