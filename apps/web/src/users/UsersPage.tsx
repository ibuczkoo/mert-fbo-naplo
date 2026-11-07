import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ROLES, ROLE_LABELS, userCreateSchema, type Role, type UserListItem } from "@fbo/shared";
import { useOnline } from "../useOnline";

type Employee = { id: string; fullName: string; badgeNumber: string | null };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = (body as { details?: { message: string }[] }).details;
    throw new Error(details?.length ? details.map((d) => d.message).join("; ") : (body as { error?: string }).error ?? "Hiba");
  }
  return body as T;
}

/**
 * Felhasználókezelés (admin). Szándékosan csak online működik:
 * jelszó nem kerülhet a készülék helyi tárolójába.
 */
export function UsersPage({ selfId }: { selfId: string }) {
  const online = useOnline();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => call<UserListItem[]>("/api/users"), enabled: online });
  const employees = useQuery({ queryKey: ["md", "employee"], queryFn: () => call<Employee[]>("/api/employees"), enabled: online });
  const empName = (id: string | null) => employees.data?.find((e) => e.id === id)?.fullName;
  const [message, setMessage] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      call<UserListItem>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) => setMessage(e.message),
  });

  if (!online) {
    return <p className="rounded-xl bg-amber-50 p-4 text-amber-900">A felhasználókezeléshez internetkapcsolat kell.</p>;
  }

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">Felhasználók</h1>
      {message && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {(users.data ?? []).map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center gap-2 px-4 py-2 ${u.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {u.username}
                    {u.id === selfId && <span className="ml-2 text-xs text-slate-500">(Ön)</span>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {ROLE_LABELS[u.role]}
                    {u.employeeId && ` · ${empName(u.employeeId) ?? "dolgozó"}`}
                    {!u.active && " · tiltva"}
                  </div>
                </div>
                <button
                  className="rounded-lg px-3 text-sm ring-1 ring-slate-300"
                  onClick={() => {
                    const pw = prompt(`Új jelszó (${u.username}): legalább 10 karakter, betű és szám`);
                    if (pw) update.mutate({ id: u.id, patch: { password: pw } }, { onSuccess: () => setMessage(null) });
                  }}
                >
                  Új jelszó
                </button>
                {u.id !== selfId && (
                  <button
                    className="rounded-lg px-3 text-sm ring-1 ring-slate-300"
                    onClick={() => update.mutate({ id: u.id, patch: { active: !u.active } })}
                  >
                    {u.active ? "Tiltás" : "Engedélyezés"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
        <NewUserForm employees={employees.data ?? []} onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })} />
      </div>
    </div>
  );
}

function NewUserForm({ employees, onCreated }: { employees: Employee[]; onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("or");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = { username, role, password, employeeId: employeeId || null };
    const parsed = userCreateSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    setBusy(true);
    try {
      await call("/api/users", { method: "POST", body: JSON.stringify(parsed.data) });
      setUsername("");
      setPassword("");
      setEmployeeId("");
      setError(null);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3";
  return (
    <form onSubmit={submit} noValidate className="space-y-3 self-start rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-medium">Új felhasználó</h2>
      <label className="block">
        <span className="text-sm font-medium">Felhasználónév</span>
        <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="pl. nagy.jozsef" autoCapitalize="none" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Szerepkör</span>
        <select className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Dolgozó</span>
        <select className={input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">– nincs (pl. admin) –</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
              {e.badgeNumber ? ` (${e.badgeNumber})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Kezdő jelszó</span>
        <input className={input} type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        <span className="mt-1 block text-xs text-slate-500">Legalább 10 karakter, betű és szám. Adja át személyesen.</span>
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-4 font-medium text-white disabled:opacity-60">
        Felvétel
      </button>
    </form>
  );
}
