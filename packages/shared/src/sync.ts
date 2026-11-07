import { z } from "zod";

/**
 * Offline szinkron. A készülék minden mentést előbb helyben, egy műveletként
 * tárol (saját UUID-vel), majd sorrendben felküldi. A szerver az azonosító
 * alapján felismeri az ismételten beküldött műveletet, így semmi nem rögzül kétszer.
 */

export const syncOpSchema = z.object({
  opId: z.string().uuid(),
  /** Művelettípus, pl. "masterData.create" – a szerver regisztrált kezelőt keres hozzá. */
  type: z.string().min(1).max(64),
  /** A készüléken mért létrehozási idő (ISO). A szerver a saját idejét is rögzíti. */
  createdAt: z.string().datetime(),
  payload: z.unknown(),
});
export type SyncOp = z.infer<typeof syncOpSchema>;

export const syncRequestSchema = z.object({
  ops: z.array(syncOpSchema).min(1).max(50),
});

export type SyncOpResult =
  | { opId: string; status: "applied"; result?: unknown }
  | { opId: string; status: "duplicate"; result?: unknown }
  /** Végleges hiba (hibás adat, nincs jogosultság): újrapróbálni felesleges, a felhasználónak jelezni kell. */
  | { opId: string; status: "rejected"; error: string; details?: unknown }
  /** Ütközés: az adatot közben más módosította; kézi döntés kell. */
  | { opId: string; status: "conflict"; error: string };

export interface SyncResponse {
  results: SyncOpResult[];
}
