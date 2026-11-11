"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Field, Modal, Spinner, useToast } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { fmtDateTime } from "@/lib/time";

type U = { id: string; name: string; username: string; role: Role; active: boolean; createdAt: string };
const ROLES = Object.keys(ROLE_LABELS) as Role[];
const ROLE_HINT: Record<Role, string> = {
  OWNER: "كل شي، مع الموظفين",
  MANAGER: "كل شي ما عدا الموظفين",
  ACCOUNTANT: "التقارير، الفواتير، الأسعار، الضريبة والدولار",
  CASHIER: "الصالة، الطلبات، الدفع، الوردية، الحجوزات",
  WAITER: "الصالة، الطلبات، النداءات",
  KITCHEN: "شاشة المطبخ بس",
};

export default function UsersPage() {
  const toast = useToast();
  const [list, setList] = useState<U[] | null>(null);
  const [edit, setEdit] = useState<Partial<U> & { password?: string } | null>(null);
  const [logs, setLogs] = useState<{ id: string; action: string; user: string; createdAt: string; data: unknown }[]>([]);
  const load = useCallback(() => api<{ users: U[] }>("/api/admin/users").then((r) => setList(r.users)), []);
  useEffect(() => { load(); api<{ logs: typeof logs }>("/api/admin/audit").then((r) => setLogs(r.logs)).catch(() => {}); }, [load]);

  const save = async () => {
    if (!edit) return;
    try {
      if (edit.id) await api(`/api/admin/users/${edit.id}`, { method: "PATCH", body: { name: edit.name, role: edit.role, active: edit.active, ...(edit.password ? { password: edit.password } : {}) } });
      else await api("/api/admin/users", { body: { name: edit.name, username: edit.username, role: edit.role, password: edit.password } });
      toast("انحفظ");
      setEdit(null);
      load();
    } catch (e) { toast((e as Error).message, "err"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl leading-none">الموظفين</h1>
        <button className="btn-neon" onClick={() => setEdit({ role: "WAITER", active: true })}>+ موظف</button>
      </div>
      {!list ? <Spinner /> : (
        <div className="card divide-y divide-white/5">
          {list.map((u) => (
            <div key={u.id} className={`flex items-center justify-between p-3 ${!u.active ? "opacity-50" : ""}`}>
              <div><div className="font-semibold">{u.name} <span className="text-xs text-white/40" dir="ltr">@{u.username}</span></div><div className="text-xs text-white/50">{ROLE_LABELS[u.role]}{!u.active && " · موقوف"}</div></div>
              <button className="text-xs text-neon hover:underline" onClick={() => setEdit(u)}>تعديل</button>
            </div>
          ))}
        </div>
      )}
      <div>
        <h2 className="mb-2 font-semibold">سجل العمليات</h2>
        <div className="card max-h-96 divide-y divide-white/5 overflow-y-auto text-xs">
          {logs.map((l) => (
            <div key={l.id} className="flex justify-between gap-3 p-2.5">
              <span><b>{l.user}</b> · <span className="text-white/70">{l.action}</span> {l.data ? <span className="text-white/40" dir="ltr">{JSON.stringify(l.data).slice(0, 120)}</span> : null}</span>
              <span className="num shrink-0 text-white/40">{fmtDateTime(l.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? "تعديل موظف" : "موظف جديد"}>
          <div className="space-y-3">
            <Field label="الاسم"><input className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            {!edit.id && <Field label="اسم الدخول (إنكليزي)"><input className="input" dir="ltr" value={edit.username ?? ""} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></Field>}
            <Field label="الصلاحية" hint={edit.role ? ROLE_HINT[edit.role] : undefined}>
              <select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </Field>
            <Field label={edit.id ? "كلمة سر جديدة (اتركها فاضية إذا ما بدك تغيرها)" : "كلمة السر (6 أحرف عالأقل)"}><input className="input" dir="ltr" type="password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            {edit.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> الحساب شغّال</label>}
            <button className="btn-neon w-full" onClick={save}>حفظ</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
