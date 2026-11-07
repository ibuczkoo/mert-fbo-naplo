import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { MASTER_DATA, MASTER_DATA_KINDS, type MasterDataKind } from "@fbo/shared";
import { refreshBootstrap, useBootstrap, useOutboxItems } from "../offline/hooks";
import { syncEngine } from "../offline/sync";
import { navigate } from "../useHashRoute";
import { useOnline } from "../useOnline";
import { FIELDS, rowSubtitle, rowTitle, toInput } from "./fields";

type Row = Record<string, unknown> & { id: string; active: boolean };

const BOOTSTRAP_KEY: Record<MasterDataKind, string> = {
  employee: "employees",
  equipment: "equipment",
  weapon: "weapons",
  gate: "gates",
  incidentCategory: "incidentCategories",
};

export function MasterDataPage({ kindPath }: { kindPath: string | undefined }) {
  const kind = MASTER_DATA_KINDS.find((k) => MASTER_DATA[k].path === kindPath) ?? "employee";
  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">Törzsadatok</h1>
      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Törzsadat-típusok">
        {MASTER_DATA_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => navigate("torzsadatok", MASTER_DATA[k].path)}
            className={`whitespace-nowrap rounded-full px-4 text-sm ${k === kind ? "bg-brand text-white" : "bg-white ring-1 ring-slate-300"}`}
            aria-current={k === kind ? "page" : undefined}
          >
            {MASTER_DATA[k].label}
          </button>
        ))}
      </nav>
      <KindPanel key={kind} kind={kind} />
    </div>
  );
}

function KindPanel({ kind }: { kind: MasterDataKind }) {
  const online = useOnline();
  const qc = useQueryClient();
  const { data: boot } = useBootstrap();
  const outbox = useOutboxItems().filter((i) => (i.payload as { kind?: string })?.kind === kind);
  const path = MASTER_DATA[kind].path;

  const list = useQuery({
    queryKey: ["md", kind],
    queryFn: async (): Promise<Row[]> => {
      const res = await fetch(`/api/${path}?all=1`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Nem sikerült betölteni");
      return res.json();
    },
    enabled: online,
  });
  // Offline: a készüléken tárolt (aktív) törzsadat.
  const rows: Row[] = list.data ?? ((boot?.[BOOTSTRAP_KEY[kind] as keyof typeof boot] as Row[] | undefined) ?? []);
  const fromCache = !list.data;

  async function submitOp(type: string, payload: unknown) {
    await syncEngine.enqueue(type, payload);
    if (navigator.onLine) {
      await syncEngine.flush();
      await Promise.all([qc.invalidateQueries({ queryKey: ["md", kind] }), refreshBootstrap()]);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {fromCache && (
          <p className="border-b border-slate-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Offline nézet: a készüléken tárolt aktív adatok látszanak.
          </p>
        )}
        {outbox.length > 0 && (
          <ul className="border-b border-slate-200">
            {outbox.map((o) => (
              <li key={o.opId} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="font-medium">{pendingLabel(kind, o.type, o.payload)}</span>
                <span className={o.status === "pending" ? "text-slate-600" : "text-red-700"}>
                  {o.status === "pending" ? "szinkronizálásra vár" : `elutasítva: ${o.error}`}
                </span>
                {o.status !== "pending" && (
                  <button className="ml-auto text-sm underline" onClick={() => syncEngine.discard(o.opId)}>
                    Elvetés
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Még nincs felvett adat.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-2 ${r.active ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{rowTitle(kind, r)}</div>
                  {rowSubtitle(kind, r) && <div className="text-sm text-slate-500">{rowSubtitle(kind, r)}</div>}
                </div>
                {!fromCache && (
                  <button
                    className="ml-auto rounded-lg px-3 text-sm ring-1 ring-slate-300"
                    onClick={() => submitOp("masterData.update", { kind, id: r.id, data: { active: !r.active } })}
                  >
                    {r.active ? "Inaktiválás" : "Aktiválás"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <AddForm kind={kind} onSubmit={(data) => submitOp("masterData.create", { kind, data })} />
    </div>
  );
}

function pendingLabel(kind: MasterDataKind, type: string, payload: unknown): string {
  const p = payload as { data?: Record<string, unknown> };
  if (type === "masterData.create" && p.data) return rowTitle(kind, p.data);
  if (p.data && "active" in p.data) return p.data.active ? "Aktiválás" : "Inaktiválás";
  return "Módosítás";
}

function AddForm({ kind, onSubmit }: { kind: MasterDataKind; onSubmit: (data: unknown) => Promise<void> }) {
  const fields = FIELDS[kind];
  const initial = () => Object.fromEntries(fields.map((f) => [f.name, f.options ? Object.keys(f.options)[0]! : ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = toInput(kind, values);
    const parsed = MASTER_DATA[kind].schema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(input);
      setValues(initial());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 self-start rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" noValidate>
      <h2 className="font-medium">Új felvétele</h2>
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="text-sm font-medium">
            {f.label}
            {f.optional && <span className="font-normal text-slate-500"> (nem kötelező)</span>}
          </span>
          {f.type === "select" ? (
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3"
              value={values[f.name]}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            >
              {Object.entries(f.options!).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3"
              value={values[f.name] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              aria-invalid={Boolean(errors[f.name])}
            />
          )}
          {errors[f.name] && <span className="mt-1 block text-sm text-red-700">{errors[f.name]}</span>}
        </label>
      ))}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-4 font-medium text-white disabled:opacity-60">
        Mentés
      </button>
      <p className="text-xs text-slate-500">Internet nélkül is menthető; a kapcsolat visszatérésekor feltöltődik.</p>
    </form>
  );
}
