import type { ReactNode } from "react";
import { ROLE_LABELS, type SessionUser } from "@fbo/shared";
import { modulesFor } from "./modules";
import { useOutboxCounts } from "./offline/hooks";
import { navigate } from "./useHashRoute";
import { useOnline } from "./useOnline";

export function Shell({ user, onLogout, children }: { user: SessionUser; onLogout: () => void; children: ReactNode }) {
  const online = useOnline();
  const { pending, problems } = useOutboxCounts();
  const name = user.employee?.fullName ?? user.username;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-brand text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
          <button onClick={() => navigate()} className="flex items-center gap-2" aria-label="Kezdőlap">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="hidden whitespace-nowrap font-semibold sm:inline">FBŐ napló</span>
          </button>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${online ? "bg-emerald-500/20" : "bg-amber-400 text-slate-900"}`}
            aria-live="polite"
          >
            {online ? "Online" : "Offline – helyben ment"}
          </span>
          {pending > 0 && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs" aria-live="polite">
              {pending} szinkronizálásra vár
            </span>
          )}
          {problems > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs">{problems} elutasítva</span>}
          <div className="ml-auto text-right text-sm leading-tight">
            <div className="font-medium">{name}</div>
            <div className="text-white/70">{ROLE_LABELS[user.role]}</div>
          </div>
          <button onClick={onLogout} className="rounded-lg px-3 text-sm hover:bg-white/10">
            Kilépés
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

const ROUTES: Record<string, string> = { masterdata: "torzsadatok" };

export function Home({ user }: { user: SessionUser }) {
  const modules = modulesFor(user.role);
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Modulok</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const route = ROUTES[m.key];
          const body = (
            <>
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-slate-600">{m.description}</div>
              {!route && <div className="mt-2 text-xs text-slate-500">Elkészül: {m.phase}. fázis</div>}
            </>
          );
          return (
            <li key={m.key}>
              {route ? (
                <button
                  onClick={() => navigate(route)}
                  className="block w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand"
                >
                  {body}
                </button>
              ) : (
                <div className="rounded-xl bg-white/60 p-4 ring-1 ring-slate-200">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
