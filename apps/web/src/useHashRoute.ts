import { useSyncExternalStore } from "react";

/** Egyszerű hash-alapú útvonal (#/torzsadatok/fegyverek): offline is működik, szerveroldali útvonal nélkül. */
function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useHashRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

export function navigate(...parts: string[]) {
  window.location.hash = "/" + parts.join("/");
}
