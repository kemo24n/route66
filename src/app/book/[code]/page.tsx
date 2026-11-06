"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicShell";
import { api } from "@/lib/client";
import { arDateLabel, fmtTime, localDateStr } from "@/lib/time";
import { Spinner } from "@/components/ui";

type B = {
  code: string; name: string; partySize: number; startAt: string; status: string; holdUntil: string | null;
  table: { label: string; zone?: string } | null; whatsapp: string; restaurantPhone: string;
};

export default function BookingStatus({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [b, setB] = useState<B | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [, tick] = useState(0);

  const load = () => api<B>(`/api/public/bookings/${code}`).then(setB).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
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

  if (!b) return (<><PublicHeader /><main className="mx-auto max-w-lg px-4 py-16 text-center">{err ? <p className="text-white/60">{err}</p> : <Spinner />}</main></>);

  const when = `${arDateLabel(localDateStr(new Date(b.startAt)))} الساعة ${fmtTime(b.startAt)}`;
  const wa = `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(`مرحبا، بدي أكد حجزي برقم ${b.code} (${b.name}، ${b.partySize} أشخاص، ${when})`)}`;
  const left = b.holdUntil ? Math.max(0, new Date(b.holdUntil).getTime() - Date.now()) : 0;
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);

  const view: Record<string, { title: string; text: string; tone: string }> = {
    CONFIRMED: { title: "حجزك مأكد", text: "منستناك. إذا تغيرت خططك ألغي الحجز من هون لنعطي الطاولة لغيرك.", tone: "text-brand-200" },
    PENDING: { title: "باقي خطوة وحدة", text: "ابعتلنا رسالة واتساب لنأكد الحجز. الطاولة محفوظة إلك لحد ما يخلص الوقت.", tone: "text-neon" },
    REVIEW: { title: "حجزك وصلنا", text: "رح نتواصل معك لنأكد. فيك تسرّع الموضوع وتبعتلنا عالواتساب.", tone: "text-neon" },
    SEATED: { title: "أهلا وسهلا", text: "صحتين وعافية.", tone: "text-brand-200" },
    COMPLETED: { title: "شكراً لزيارتك", text: "نتمنى نشوفك مرة تانية.", tone: "text-white" },
    CANCELLED: { title: "الحجز انلغى", text: "فيك تعمل حجز جديد بأي وقت.", tone: "text-white/70" },
    EXPIRED: { title: "انتهت مهلة التأكيد", text: "ما وصلنا تأكيد بالوقت، فانفكت الطاولة. فيك تحجز من جديد.", tone: "text-white/70" },
    REJECTED: { title: "ما قدرنا نثبت الحجز", text: "اتصل فينا لنرتبلك طاولة.", tone: "text-red-300" },
    NO_SHOW: { title: "الحجز انتهى", text: "", tone: "text-white/70" },
  };
  const v = view[b.status] ?? view.CONFIRMED;

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 pb-20 pt-8">
        <div className="card overflow-hidden">
          <div className="bg-brand-900 p-6 text-center">
            <div className={`text-2xl font-bold ${v.tone}`}>{v.title}</div>
            <p className="mt-2 text-sm text-white/70">{v.text}</p>
            {b.status === "PENDING" && left > 0 && <div className="num mt-3 text-3xl font-bold text-neon">{mm}:{String(ss).padStart(2, "0")}</div>}
          </div>
          <div className="space-y-2.5 p-6 text-sm">
            <Row k="رقم الحجز" v={<span className="num font-bold tracking-wider">{b.code}</span>} />
            <Row k="الاسم" v={b.name} />
            <Row k="الموعد" v={when} />
            <Row k="عدد الأشخاص" v={b.partySize} />
            {b.table && <Row k="الطاولة" v={`${b.table.label} · ${b.table.zone ?? ""}`} />}
          </div>
          <div className="space-y-2 border-t border-white/5 p-6">
            {(b.status === "PENDING" || b.status === "REVIEW") && <a href={wa} target="_blank" rel="noreferrer" className="btn w-full bg-[#25D366] py-3 text-base text-white">أكد عالواتساب</a>}
            {["PENDING", "CONFIRMED", "REVIEW"].includes(b.status) && (
              cancelOpen ? (
                <div className="space-y-2 rounded-xl bg-white/5 p-3">
                  <input className="input num text-left" inputMode="tel" placeholder="رقم الموبايل يلي حجزت فيه" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <button onClick={cancel} className="btn-danger w-full">تأكيد الإلغاء</button>
                </div>
              ) : <button onClick={() => setCancelOpen(true)} className="btn-ghost w-full">إلغاء الحجز</button>
            )}
            {["CANCELLED", "EXPIRED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(b.status) && <Link href="/book" className="btn-neon w-full">حجز جديد</Link>}
            <a href={`tel:${b.restaurantPhone}`} className="block pt-1 text-center text-xs text-white/50">للاستفسار: <span className="num">{b.restaurantPhone}</span></a>
            {err && <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">احفظ رابط هالصفحة لترجع تشوف حالة حجزك</p>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-white/50">{k}</span><span className="text-left">{v}</span></div>;
}
