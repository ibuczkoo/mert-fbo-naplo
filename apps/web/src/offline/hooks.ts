import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import type { BootstrapPayload } from "@fbo/shared";
import { localDb } from "./db";

/** A szinkronizálásra váró és az elutasított műveletek száma, élőben. */
export function useOutboxCounts(): { pending: number; problems: number } {
  return (
    useLiveQuery(async () => {
      const all = await localDb.outbox.toArray();
      return {
        pending: all.filter((i) => i.status === "pending").length,
        problems: all.filter((i) => i.status !== "pending").length,
      };
    }) ?? { pending: 0, problems: 0 }
  );
}

export function useOutboxItems() {
  return useLiveQuery(() => localDb.outbox.orderBy("seq").toArray()) ?? [];
}

/** Törzsadat-csomag letöltése a készülékre (bejelentkezéskor és óránként). */
export async function refreshBootstrap(): Promise<BootstrapPayload | null> {
  try {
    const res = await fetch("/api/bootstrap", { credentials: "same-origin" });
    if (!res.ok) return null;
    const value = (await res.json()) as BootstrapPayload;
    await localDb.cache.put({ key: "bootstrap", value, updatedAt: new Date().toISOString() });
    return value;
  } catch {
    return null;
  }
}

/** A készüléken tárolt törzsadat; offline is elérhető. */
export function useBootstrap(): { data: BootstrapPayload | null; updatedAt: string | null } {
  const item = useLiveQuery(() => localDb.cache.get("bootstrap"));
  return { data: (item?.value as BootstrapPayload) ?? null, updatedAt: item?.updatedAt ?? null };
}

export function useAutoBootstrap(enabled: boolean, intervalMs = 3600_000) {
  useEffect(() => {
    if (!enabled) return;
    void refreshBootstrap();
    const t = window.setInterval(() => navigator.onLine && void refreshBootstrap(), intervalMs);
    const onOnline = () => void refreshBootstrap();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, intervalMs]);
}
