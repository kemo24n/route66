"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/PublicShell";
import { BookingMap } from "@/components/BookingMap";
import { type MapTable } from "@/components/FloorMap";
import { api, deviceId } from "@/lib/client";
import { arDateLabel } from "@/lib/time";
import { Spinner } from "@/components/ui";

type Slot = { time: string; available: boolean; freeTables: number; fill?: number };
type Zone = { id: string; name: string; width: number; height: number };
type T = MapTable & { state: "free" | "busy" | "small" | "closed"; fit: boolean };

export default function BookPage() {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [party, setParty] = useState(2);
  const [maxParty, setMaxParty] = useState(12);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [tables, setTables] = useState<T[] | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [alt, setAlt] = useState<{ label: string; id: string; times: string[] } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlots(null);
    setTime(null);
    setTables(null);
    setTableId(null);
    api<{ enabled: boolean; dates: string[]; date: string; slots: Slot[]; maxParty: number }>(`/api/public/slots?party=${party}${date ? `&date=${date}` : ""}`)
      .then((r) => {
        setEnabled(r.enabled);
        setDates(r.dates);
        if (!date) setDate(r.date);
        setSlots(r.slots);
        if (r.maxParty) setMaxParty(r.maxParty);
      })
      .catch((e) => setErr(e.message));
  }, [party, date]);

  useEffect(() => {
    if (!date || !time) return;
    setTables(null);
    setTableId(null);
    api<{ zones: Zone[]; tables: T[] }>(`/api/public/availability?date=${date}&time=${time}&party=${party}`).then((r) => {
      setZones(r.zones);
      setTables(r.tables);
      const fit = r.tables.find((t) => t.fit);
      setZone((z) => z ?? fit?.zoneId ?? r.zones[0]?.id ?? null);
      setTimeout(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    });
  }, [date, time, party]);

  const selected = tables?.find((t) => t.id === tableId);
  const zoneObj = zones.find((z) => z.id === zone);
  const zoneTables = useMemo(() => (tables ?? []).filter((t) => t.zoneId === zone), [tables, zone]);
  const freeIn = (zid: string) => (tables ?? []).filter((t) => t.zoneId === zid && t.state === "free").length;

  const pick = (t: MapTable) => {
    const x = tables?.find((y) => y.id === t.id);
    if (x && x.state === "busy" && date) {
      setTableId(null);
      api<{ times: string[] }>(`/api/public/table-times?date=${date}&tableId=${x.id}`).then((r) => setAlt({ label: x.label, id: x.id, times: r.times.filter((v) => v !== time) })).catch(() => {});
      return;
    }
    if (!x || x.state !== "free") return;
    setAlt(null);
    setTableId(t.id);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !phone.trim()) return setErr("اكتب الاسم ورقم الموبايل");
    setBusy(true);
    try {
      const r = await api<{ code: string }>("/api/public/bookings", {
        body: { name, phone, partySize: party, date, time, tableId, notes: notes || undefined, deviceId: deviceId(), elapsedMs: Date.now() - startedAt.current, website: hp },
      });
      router.push(`/book/${r.code}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <h1 className="text-4xl font-bold"><span className="text-shine">احجز طاولة</span></h1>
        <p className="mt-1 text-sm text-white/50">اختار الوقت، بعدين اختار طاولتك من الخريطة</p>

        {!enabled && <div className="card mt-6 p-5 text-white/70">الحجز أونلاين موقف حالياً. اتصل فينا لنحجزلك.</div>}

        <section className="card mt-6 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">كم شخص؟</div>
              <div className="text-xs text-white/40">لأكتر من {maxParty} اتصل فينا</div>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-ghost h-10 w-10 p-0 text-xl" onClick={() => setParty((p) => Math.max(1, p - 1))} aria-label="أقل">−</button>
              <span className="num w-8 text-center text-2xl font-bold">{party}</span>
              <button className="btn-ghost h-10 w-10 p-0 text-xl" onClick={() => setParty((p) => Math.min(maxParty, p + 1))} aria-label="أكتر">+</button>
            </div>
          </div>

          <div className="mt-5 font-semibold">أي يوم؟</div>
          <div className="scrollbar-none -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {dates.map((d, i) => (
              <button key={d} onClick={() => setDate(d)} className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm ${date === d ? "border-neon bg-neon/10 text-neon" : "border-white/10 text-white/70 hover:border-white/30"}`}>
                {i === 0 ? "اليوم" : i === 1 ? "بكرا" : arDateLabel(d)}
              </button>
            ))}
          </div>

          <div className="mt-5 font-semibold">الساعة كم؟</div>
          {!slots ? <div className="mt-3"><Spinner /></div> : slots.length === 0 ? <div className="mt-2 text-sm text-white/50">ما في أوقات بهاليوم</div> : (
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map((s) => (
                <button key={s.time} disabled={!s.available} onClick={() => setTime(s.time)}
                  className={`num rounded-xl border py-2 text-sm ${time === s.time ? "border-neon bg-neon text-ink-900 font-bold" : s.available ? "border-white/10 hover:border-white/30" : "border-white/5 text-white/20 line-through"}`}>
                  {s.time}
                  {s.available && (s.fill ?? 0) >= 70 && <span className="block text-[9px] font-normal text-orange-300">🔥 بتخلص</span>}
                  {s.available && (s.fill ?? 0) > 0 && <i className="mx-auto mt-1 block h-[3px] rounded bg-current opacity-40" style={{ width: `${Math.max(12, s.fill ?? 0)}%` }} />}
                </button>
              ))}
            </div>
          )}
        </section>

        {time && (
          <section ref={mapRef} className="card mt-4 scroll-mt-20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">اختار طاولتك</div>
              <div className="flex gap-1">
                {zones.map((z) => (
                  <button key={z.id} onClick={() => setZone(z.id)} className={`tab ${zone === z.id ? "tab-active" : ""}`}>
                    {z.name} <span className="num text-[11px] opacity-60">{freeIn(z.id)}</span>
                  </button>
                ))}
              </div>
            </div>
            {!tables || !zoneObj ? <div className="py-10 text-center"><Spinner /></div> : (
              <>
                <div className="-mx-4 overflow-x-auto px-4 pb-1">
                <BookingMap tables={zoneTables} selectedId={tableId} onSelect={pick} />
                </div>
                {alt && (
                  <div className="mt-3 rounded-xl border border-neon/30 bg-neon/5 p-3 text-sm">
                    <div>طاولة <b>{alt.label}</b> محجوزة بهاد الوقت.{alt.times.length ? " متاحة بهالأوقات:" : " ما في أوقات فاضية عليها بهاليوم."}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {alt.times.map((v) => <button key={v} className="num rounded-lg border border-neon px-3 py-1 text-neon hover:bg-neon hover:text-ink-900" onClick={() => { setTime(v); setAlt(null); }}>{v}</button>)}
                    </div>
                    {slots && !!slots.filter((x) => x.available && x.time !== time).length && (
                      <div className="mt-2 text-[11px] text-white/50">أو جرّب وقت تاني فيه طاولات: {slots.filter((x) => x.available && x.time !== time).sort((a, b) => Math.abs(a.time.localeCompare(time ?? "")) - Math.abs(b.time.localeCompare(time ?? ""))).slice(0, 3).map((x) => x.time).join(" · ")}</div>
                    )}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-white/35 sm:hidden">اسحب الخريطة يمين وشمال لتشوف كل الطاولات</div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/50">
                  <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-[#1d4a25] ring-1 ring-brand-300" />فاضية</span>
                  <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-[#2c5a33] ring-1 ring-neon" />★ الأنسب لعددكم</span>
                  <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-[#3a1f1f]" />محجوزة</span>
                </div>
              </>
            )}
          </section>
        )}

        {selected && (
          <section ref={formRef} className="card mt-4 scroll-mt-20 p-5">
            <div className="mb-4 rounded-xl bg-brand-900/60 p-3 text-sm">
              طاولة <b>{selected.label}</b> · {zoneObj?.name} · <span className="num">{time}</span> · {date && arDateLabel(date)} · {party} أشخاص
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">الاسم</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label className="block"><span className="label">رقم الموبايل</span><input className="input num w-full text-left" inputMode="tel" placeholder="09xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
            </div>
            <label className="mt-3 block"><span className="label">ملاحظة (اختياري)</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="عيد ميلاد، كرسي أطفال..." /></label>
            {/* bots fill every field; people never see this one */}
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
            {err && <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
            <button onClick={submit} disabled={busy} className="btn-neon mt-4 w-full py-3 text-base">{busy ? <Spinner /> : "ثبّت الحجز"}</button>
            <p className="mt-2 text-center text-[11px] text-white/40">الطاولة بتنحفظلك ساعتين من وقت الحجز. إذا تأخرت أكتر من 20 دقيقة ممكن تنعطى لغيرك.</p>
          </section>
        )}
        {err && !selected && <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
      </main>
    </>
  );
}
