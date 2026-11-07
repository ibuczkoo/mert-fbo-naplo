import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { can, type SessionUser } from "@fbo/shared";
import { api } from "./api";
import { LoginPage } from "./LoginPage";
import { MasterDataPage } from "./masterdata/MasterDataPage";
import { enforceInactivityWipe, touchActivity, wipeLocalData } from "./offline/db";
import { useAutoBootstrap } from "./offline/hooks";
import { startAutoSync, syncEngine } from "./offline/sync";
import { Home, Shell } from "./Shell";
import { useHashRoute } from "./useHashRoute";

const ME_KEY = ["me"];
const LAST_USER = "fbo.lastUser";
/** Offline indulásnál legfeljebb ennyi ideig használható a legutóbbi bejelentkezés (= a munkamenet hossza). */
const OFFLINE_SESSION_MS = 12 * 3600_000;

function rememberUser(u: SessionUser | null) {
  if (u) localStorage.setItem(LAST_USER, JSON.stringify({ user: u, at: Date.now() }));
  else localStorage.removeItem(LAST_USER);
}

function offlineUser(): SessionUser | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_USER) ?? "null") as { user: SessionUser; at: number } | null;
    return v && Date.now() - v.at < OFFLINE_SESSION_MS ? v.user : null;
  } catch {
    return null;
  }
}

export function App() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      await enforceInactivityWipe();
      try {
        const u = await api.me();
        rememberUser(u);
        return u;
      } catch {
        // Offline indulás: az utolsó bejelentkezett felhasználóval megy tovább.
        // A szerver minden szinkronnál újra ellenőrzi a munkamenetet.
        return offlineUser();
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  const user = me.data ?? null;
  const route = useHashRoute();

  useEffect(() => (user ? startAutoSync() : undefined), [user]);
  useAutoBootstrap(Boolean(user));
  useEffect(() => {
    const t = () => touchActivity();
    window.addEventListener("pointerdown", t);
    return () => window.removeEventListener("pointerdown", t);
  }, []);

  if (me.isPending) return <p className="p-6 text-slate-600">Betöltés…</p>;

  const setUser = (u: SessionUser | null) => {
    rememberUser(u);
    qc.setQueryData(ME_KEY, u);
  };

  if (!user) return <LoginPage onLoggedIn={setUser} />;

  async function logout() {
    const pending = await syncEngine.pendingCount();
    if (pending > 0) {
      const flushed = navigator.onLine ? await syncEngine.flush() : null;
      const left = await syncEngine.pendingCount();
      if (left > 0) {
        const ok = confirm(
          `${left} rögzítés még nincs feltöltve${flushed?.kind === "offline" || !navigator.onLine ? " (nincs internet)" : ""}. ` +
            "Kilépéskor ezek a készülékről törlődnek. Biztosan kilép?",
        );
        if (!ok) return;
      }
    }
    await api.logout().catch(() => undefined);
    await wipeLocalData();
    setUser(null);
    // A többi lekérdezés (törzsadat stb.) gyorsítótára is törlődik; a "me" megfigyelője megmarad.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
  }

  let page = <Home user={user} />;
  if (route[0] === "torzsadatok" && can(user.role, "masterData.manage")) {
    page = <MasterDataPage kindPath={route[1]} />;
  }

  return (
    <Shell user={user} onLogout={logout}>
      {page}
    </Shell>
  );
}
