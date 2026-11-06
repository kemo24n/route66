"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/img/logo.svg" alt="" className="h-16 w-16" />
          <h1 className="mt-3 text-xl font-bold">دخول الموظفين</h1>
          <p className="text-xs text-white/40">Route 66</p>
        </div>
        <label className="block"><span className="label">اسم المستخدم</span><input className="input text-left" dir="ltr" autoCapitalize="none" value={username} onChange={(e) => setU(e.target.value)} autoFocus /></label>
        <label className="mt-3 block"><span className="label">كلمة السر</span><input className="input text-left" dir="ltr" type="password" value={password} onChange={(e) => setP(e.target.value)} /></label>
        {err && <div className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-center text-sm text-red-300">{err}</div>}
        <button className="btn-primary mt-5 w-full py-3" disabled={busy}>{busy ? <Spinner /> : "دخول"}</button>
      </form>
    </main>
  );
}
