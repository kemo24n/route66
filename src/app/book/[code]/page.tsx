"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "motion/react";
import { PublicHeader } from "@/components/PublicShell";
import { api } from "@/lib/client";
import { arDateLabel, fmtTime, localDateStr } from "@/lib/time";
import { Shield, Arrow } from "@/components/Signs";

type B = {
  code: string; name: string; partySize: number; startAt: string; status: string; holdUntil: string | null;
  table: { label: string; zone?: string } | null; whatsapp: string; restaurantPhone: string;
};

const STAMP: Record<string, { t: string; c: string; title: string; text: string }> = {
  CONFIRMED: { t: "مأكد", c: "#1D6B3A", title: "منستناك.", text: "حجزك ثابت. إذا تغيرت خططك ألغي من هون لنعطي الطاولة لغيرك." },
  PENDING: { t: "ناطر تأكيد", c: "#C98A00", title: "باقي خطوة.", text: "ابعتلنا رسالة واتساب وحدة لنأكد. الطاولة محفوظة إلك لحد ما يخلص العداد." },
  REVIEW: { t: "وصلنا", c: "#C98A00", title: "حجزك وصل.", text: "رح نتواصل معك لنأكد. فيك تسرّعها برسالة واتساب." },
  SEATED: { t: "أهلا وسهلا", c: "#1D6B3A", title: "صحتين.", text: "انبسطوا." },
  COMPLETED: { t: "تمت الزيارة", c: "#3B3E33", title: "شكراً إلك.", text: "نتمنى نشوفك قريب." },
  CANCELLED: { t: "ملغى", c: "#757060", title: "انلغى الحجز.", text: "فيك تعمل حجز جديد بأي وقت." },
  EXPIRED: { t: "انتهت المهلة", c: "#757060", title: "انتهت المهلة.", text: "ما وصل تأكيد بالوقت فانفكت الطاولة. احجز من جديد." },
  REJECTED: { t: "ما تثبت", c: "#D9381E", title: "ما قدرنا نثبته.", text: "اتصل فينا ومنرتبلك طاولة." },
  NO_SHOW: { t: "انتهى", c: "#757060", title: "انتهى الحجز.", text: "" },
};

export default function BookingTicket({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [b, setB] = useState<B | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [fresh, setFresh] = useState(false);
  const [, tick] = useState(0);

  const load = () => api<B>(`/api/public/bookings/${code}`).then(setB).catch((e) => setErr(e.message));
  useEffect(() => {
    setFresh(new URLSearchParams(location.search).has("new"));
    load();
    QRCode.toDataURL(location.origin + `/book/${code}`, { margin: 0, width: 320, color: { dark: "#15170F", light: "#FBF7EE" } }).then(setQr).catch(() => {});
    const iv = setInterval(load, 15000);
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => { clearInterval(iv); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const cancel = async () => {
    try {
      await api(`/api/public/bookings/${code}`, { body: { phone } });
      setCancelOpen(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!b) {
    return (
      <div className="pub grain"><PublicHeader />
        <main className="grid min-h-[60vh] place-items-center p-6 text-center">{err ? <div><div className="font-display text-5xl">ما لقينا الحجز</div><p className="mt-2 text-coal-soft">{err}</p><Link href="/book" className="pbtn-go mt-6">احجز من جديد</Link></div> : <div className="h-10 w-10 animate-spin rounded-full border-4 border-coal/20 border-t-coal" />}</main>
      </div>
    );
  }

  const st = STAMP[b.status] ?? STAMP.CONFIRMED;
  const start = new Date(b.startAt);
  const when = `${arDateLabel(localDateStr(start))} · ${fmtTime(start)}`;
  const wa = `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(`مرحبا، بدي أكد حجزي ${b.code} (${b.name}، ${b.partySize} أشخاص، ${when})`)}`;
  const left = b.holdUntil ? Math.max(0, new Date(b.holdUntil).getTime() - Date.now()) : 0;
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const active = ["PENDING", "CONFIRMED", "REVIEW"].includes(b.status);

  const ics = () => {
    const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `UID:${b.code}@route66`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:Route 66 · طاولة ${b.table?.label ?? ""}`, `DESCRIPTION:حجز ${b.code} · ${b.partySize} أشخاص`, "LOCATION:Route 66\\, Mogambo\\, Aleppo", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = `route66-${b.code}.ics`;
    a.click();
  };

  return (
    <div className="pub grain">
      <PublicHeader />
      <main className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-24 pt-4 sm:px-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="lg:pt-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="eyebrow text-forest">{fresh ? "Booked" : "Your booking"}</div>
            <h1 className="mt-2 font-display text-[clamp(56px,9vw,104px)] leading-[.88]">{st.title}</h1>
            <p className="mt-4 max-w-md text-lg text-coal-soft">{st.text}</p>
          </motion.div>

          {b.status === "PENDING" && left > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 inline-flex items-center gap-4 rounded-[14px] border-[3px] border-coal bg-line px-5 py-3 shadow-hard">
              <span className="text-sm font-semibold">الطاولة محفوظة لـ</span>
              <span className="num font-sign text-4xl font-black tabular-nums">{mm}:{String(ss).padStart(2, "0")}</span>
            </motion.div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {(b.status === "PENDING" || b.status === "REVIEW") && (
              <a href={wa} target="_blank" rel="noreferrer" className="pbtn border-coal bg-[#25D366] px-6 py-4 text-lg text-coal shadow-hard">أكد عالواتساب <Arrow className="h-5 w-5" /></a>
            )}
            {active && <button onClick={ics} className="pbtn-plain px-5 py-4">ضيفه عالتقويم</button>}
            {active && !cancelOpen && <button onClick={() => setCancelOpen(true)} className="px-3 py-4 text-sm font-semibold text-coal-mute underline decoration-2 underline-offset-4 hover:text-tail">إلغاء الحجز</button>}
            {!active && <Link href="/book" className="pbtn-go px-6 py-4 text-lg">حجز جديد <Arrow className="h-5 w-5" /></Link>}
          </div>

          <AnimatePresence>
            {cancelOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-5 max-w-md rounded-[14px] border-[3px] border-coal bg-[#FBF7EE] p-4 shadow-hard-sm">
                  <div className="mb-2 font-semibold">لتأكيد الإلغاء اكتب رقم الموبايل يلي حجزت فيه</div>
                  <input className="pinput num text-left font-sign" inputMode="tel" placeholder="09xx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <div className="mt-3 flex gap-2"><button onClick={cancel} className="pbtn flex-1 bg-tail text-paper shadow-hard-sm">إلغاء الحجز</button><button onClick={() => setCancelOpen(false)} className="pbtn-plain">لا، خليه</button></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {err && <div className="mt-4 max-w-md rounded-[12px] border-2 border-tail bg-tail/10 p-3 font-semibold text-tail">{err}</div>}
          <p className="mt-10 text-sm text-coal-mute">للاستفسار <a href={`tel:${b.restaurantPhone}`} className="num font-semibold text-coal underline">{b.restaurantPhone}</a> · احفظ رابط هالصفحة لترجعلها</p>
        </section>

        {/* the ticket prints out of a slot */}
        <section className="relative">
          <div className="relative z-10 h-5 rounded-full border-[3px] border-coal bg-coal shadow-hard" />
          <div className="-mt-2.5 overflow-hidden px-3 pb-6">
            <motion.div initial={{ y: "-100%" }} animate={{ y: 0 }} transition={{ duration: fresh ? 1.6 : 0.8, ease: [0.3, 0.9, 0.4, 1] }}
              className="relative rounded-b-[16px] border-[3px] border-t-0 border-coal bg-[#FBF7EE] shadow-hard">
              <div className="flex items-center justify-between bg-forest px-6 pb-4 pt-6 text-paper">
                <div><div className="font-sign text-xl font-black">ROUTE 66</div><div className="text-[11px] opacity-70">Mogambo · Aleppo</div></div>
                <Shield n="66" className="h-12 w-11" />
              </div>
              <div className="px-6 pt-5">
                <div className="eyebrow text-coal-mute">رقم الحجز</div>
                <div className="num mt-1 font-sign text-4xl font-black tracking-wider">{b.code}</div>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <F k="الاسم" v={b.name} />
                  <F k="الأشخاص" v={<span className="num font-sign text-lg font-black">{b.partySize}</span>} />
                  <F k="اليوم" v={arDateLabel(localDateStr(start))} />
                  <F k="الساعة" v={<span className="num font-sign text-lg font-black">{fmtTime(start)}</span>} />
                  <F k="الطاولة" v={b.table ? <span><span className="font-sign text-lg font-black">{b.table.label}</span> <span className="text-coal-mute">{Number(b.table.label) >= 10 ? "برا عند المدخل" : "جوا بالصالة"}</span></span> : "—"} />
                </div>
              </div>
              <div className="relative my-5 h-6">
                <div className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-coal/30" />
                <span className="absolute -right-[3px] top-0 h-6 w-4 rounded-l-full border-[3px] border-r-0 border-coal bg-paper" />
                <span className="absolute -left-[3px] top-0 h-6 w-4 rounded-r-full border-[3px] border-l-0 border-coal bg-paper" />
              </div>
              <div className="flex items-center gap-4 px-6 pb-6">
                {qr ? <img src={qr} alt="" className="h-24 w-24" /> : <div className="h-24 w-24 bg-coal/10" />}
                <div className="max-w-[46%] text-xs leading-relaxed text-coal-soft">فرجي هالتذكرة عالباب، الكود بيفتح الحجز عند الموظف.</div>
              </div>
              <motion.div initial={{ scale: 2.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} transition={{ delay: fresh ? 1.7 : 0.6, type: "spring", stiffness: 500, damping: 14 }}
                className="absolute bottom-7 left-5 rounded-[10px] border-[3px] px-3 py-1 font-display text-2xl" style={{ color: st.c, borderColor: st.c, background: "rgba(251,247,238,.85)" }}>
                {st.t}
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}

function F({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><div className="text-[11px] text-coal-mute">{k}</div><div className="mt-0.5 font-semibold">{v}</div></div>;
}
