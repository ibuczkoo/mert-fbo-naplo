import Dexie, { type EntityTable } from "dexie";

/**
 * Helyi tárolás a készüléken (IndexedDB).
 *  - outbox: a még fel nem küldött saját rögzítések, sorrendben
 *  - cache:  törzsadatok és egyéb, offline is szükséges adat
 * Biztonság: kijelentkezéskor és 7 nap inaktivitás után minden törlődik.
 */

export type OutboxStatus = "pending" | "rejected" | "conflict";

export interface OutboxItem {
  opId: string;
  type: string;
  payload: unknown;
  createdAt: string;
  /** Rendezéshez: a felvétel sorszáma (azonos ezredmásodpercben is egyértelmű). */
  seq: number;
  status: OutboxStatus;
  error?: string;
  attempts: number;
}

export interface CacheItem {
  key: string;
  value: unknown;
  updatedAt: string;
}

export class LocalDb extends Dexie {
  outbox!: EntityTable<OutboxItem, "opId">;
  cache!: EntityTable<CacheItem, "key">;

  constructor(name = "fbo-naplo") {
    super(name);
    this.version(1).stores({
      outbox: "opId, seq, status",
      cache: "key",
    });
  }
}

export const localDb = new LocalDb();

const LAST_ACTIVE_KEY = "fbo.lastActive";
export const INACTIVITY_WIPE_MS = 7 * 24 * 3600_000;

export async function wipeLocalData(db: LocalDb = localDb): Promise<void> {
  await db.transaction("rw", db.outbox, db.cache, async () => {
    await db.outbox.clear();
    await db.cache.clear();
  });
}

/** Indításkor: ha 7 napja nem használták a készüléket, a helyi adat törlődik. */
export async function enforceInactivityWipe(now = Date.now(), db: LocalDb = localDb): Promise<boolean> {
  let last = 0;
  try {
    last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
  } catch {
    /* privát mód: nincs mit ellenőrizni */
  }
  const wiped = last > 0 && now - last > INACTIVITY_WIPE_MS;
  if (wiped) await wipeLocalData(db);
  touchActivity(now);
  return wiped;
}

export function touchActivity(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    /* ignore */
  }
}
