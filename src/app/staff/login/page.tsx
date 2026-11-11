"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ home: string }>("/api/auth/login", { body: { username, password } });
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/staff") ? next : r.home;
    } catch (e) {
      setErr((e as Error).message);
      setShake((s) => s + 1);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#0d0d0c] lg:grid-cols-[1fr_520px]">
      <section className="road relative hidden overflow-hidden lg:block">
        <div className="absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 animate-[r66road_1.2s_linear_infinite] opacity-80" style={{ backgroundImage: "linear-gradient(180deg,#F5C518 0 60px,transparent 60px 110px)", backgroundSize: "6px 110px" }} />
        <style>{`@keyframes r66road{to{background-position:0 110px}}`}</style>
        <div className="absolute inset-y-0 left-[12%] w-[4px] bg-paper/15" />
        <div className="absolute inset-y-0 right-[12%] w-[4px] bg-paper/15" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <img src="/img/logo.svg" alt="" className="h-16 w-16" />
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="font-sign text-[120px] font-black leading-[.8] text-paper">ROUTE<br /><span className="text-line">66</span></div>
            <div className="mt-6 font-display text-3xl text-paper/80">لوحة التشغيل</div>
          </motion.div>
          <div className="font-sign text-xs font-extrabold uppercase tracking-[.3em] text-paper/30">Mogambo · Aleppo</div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <motion.form key={shake} onSubmit={submit} className="w-full max-w-sm"
          initial={shake ? { x: 0 } : { opacity: 0, y: 20 }} animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { opacity: 1, y: 0 }} transition={{ duration: shake ? 0.4 : 0.6 }}>
          <img src="/img/logo.svg" alt="" className="mb-8 h-14 w-14 lg:hidden" />
          <h1 className="font-display text-5xl leading-none text-paper">أهلا بالفريق.</h1>
          <p className="mt-2 text-sm text-white/45">ادخل بحسابك لتبلّش الوردية.</p>
          <label className="mt-8 block"><span className="label">اسم المستخدم</span><input className="input py-3 text-left font-sign text-base" dir="ltr" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} autoFocus /></label>
          <label className="mt-4 block"><span className="label">كلمة السر</span><input className="input py-3 text-left text-base" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} /></label>
          {err && <div className="mt-4 rounded-lg border border-tail/60 bg-tail/10 p-3 text-center text-sm font-semibold text-[#ff8a75]">{err}</div>}
          <button className="btn-neon mt-6 w-full py-3.5 text-base" disabled={busy || !username || !password}>{busy ? <Spinner className="border-coal/30 border-t-coal" /> : "دخول"}</button>
          <a href="/" className="mt-6 block text-center text-xs text-white/35 hover:text-white/60">← لموقع روت</a>
        </motion.form>
      </section>
    </main>
  );
}
