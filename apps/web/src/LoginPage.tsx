import { useState, type FormEvent } from "react";
import type { SessionUser } from "@fbo/shared";
import { api, ApiError } from "./api";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (u: SessionUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await api.login({ username, password }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Váratlan hiba");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-8 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-xl font-semibold">MERT FBŐ napló</h1>
          <p className="text-sm text-slate-600">Fegyveres biztonsági őrség</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <label className="block">
          <span className="text-sm font-medium">Felhasználónév</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 text-base"
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Jelszó</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 text-base"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand px-4 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Bejelentkezés…" : "Bejelentkezés"}
        </button>
      </form>
    </main>
  );
}
