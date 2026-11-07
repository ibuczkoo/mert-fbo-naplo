import { ROLE_LABELS, type SessionUser } from "@fbo/shared";
import { modulesFor } from "./modules";
import { useOnline } from "./useOnline";

export function Shell({
  user,
  pendingSync,
  onLogout,
}: {
  user: SessionUser;
  pendingSync: number;
  onLogout: () => void;
}) {
  const online = useOnline();
  const modules = modulesFor(user.role);
  const name = user.employee?.fullName ?? user.username;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-brand text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="hidden whitespace-nowrap font-semibold sm:inline">FBŐ napló</span>
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs ${online ? "bg-emerald-500/20" : "bg-amber-400 text-slate-900"}`}
            aria-live="polite"
          >
            {online ? "Online" : "Offline – a rögzítés helyben mentődik"}
          </span>
          {pendingSync > 0 && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{pendingSync} szinkronizálásra vár</span>
          )}
          <div className="ml-auto text-right text-sm leading-tight">
            <div className="font-medium">{name}</div>
            <div className="text-white/70">{ROLE_LABELS[user.role]}</div>
          </div>
          <button onClick={onLogout} className="rounded-lg px-3 text-sm hover:bg-white/10" disabled={pendingSync > 0}>
            Kilépés
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-lg font-semibold">Modulok</h1>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <li key={m.key} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-slate-600">{m.description}</div>
              <div className="mt-2 text-xs text-slate-500">Elkészül: {m.phase}. fázis</div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
