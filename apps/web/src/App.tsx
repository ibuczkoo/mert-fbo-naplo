import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionUser } from "@fbo/shared";
import { api } from "./api";
import { LoginPage } from "./LoginPage";
import { Shell } from "./Shell";

export function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false, staleTime: 60_000 });

  if (me.isPending) {
    return <p className="p-6 text-slate-600">Betöltés…</p>;
  }

  const setUser = (u: SessionUser | null) => qc.setQueryData(["me"], u);

  if (!me.data) return <LoginPage onLoggedIn={setUser} />;

  return (
    <Shell
      user={me.data}
      pendingSync={0}
      onLogout={async () => {
        await api.logout().catch(() => undefined);
        setUser(null);
      }}
    />
  );
}
