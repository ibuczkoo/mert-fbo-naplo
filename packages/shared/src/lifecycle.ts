import { z } from "zod";
import type { Action } from "./permissions.js";

/**
 * Rekord-életciklus.
 *
 * Egy aláírandó rekord (pl. Szolgálati napló) aláírási lépések sorozatán megy végig.
 * Minden aláírás egy lépéssel előre viszi; az utolsó után a rekord lezárt
 * és módosíthatatlan. Lezárt rekordhoz csak helyesbítés (új, hivatkozó rekord) fűzhető.
 */

export const SIGNATURE_ROLES = [
  "atado", // átadó
  "atvevo", // átvevő
  "ellenorzo", // ellenőrző
  "kiado", // eszköz kiadója
  "visszavevo", // visszavételt igazoló
] as const;
export const signatureRoleSchema = z.enum(SIGNATURE_ROLES);
export type SignatureRole = z.infer<typeof signatureRoleSchema>;

export const SIGNATURE_ROLE_LABELS: Record<SignatureRole, string> = {
  atado: "átadtam",
  atvevo: "átvettem",
  ellenorzo: "ellenőrizte",
  kiado: "kiadta",
  visszavevo: "visszavette",
};

export interface SignatureStep {
  role: SignatureRole;
  /** A státusz, amelybe a rekord ennél a lépésnél kerül. */
  reachesStatus: RecordStatus;
  /** A lépéshez szükséges jogosultság. */
  requires: Action;
}

export const RECORD_STATUSES = ["draft", "handedOver", "takenOver", "closed"] as const;
export const recordStatusSchema = z.enum(RECORD_STATUSES);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "Piszkozat",
  handedOver: "Átadva",
  takenOver: "Átvéve",
  closed: "Lezárt",
};

/** A Szolgálati napló és a Fegyver pecsét aláírási sora. */
export const HANDOVER_FLOW: readonly SignatureStep[] = [
  { role: "atado", reachesStatus: "handedOver", requires: "shift.edit" },
  { role: "atvevo", reachesStatus: "takenOver", requires: "shift.edit" },
  { role: "ellenorzo", reachesStatus: "closed", requires: "record.signCheck" },
];

export interface ExistingSignature {
  role: SignatureRole;
  employeeId: string;
}

export type SignCheck =
  | { ok: true; step: SignatureStep }
  | { ok: false; reason: "closed" | "wrongOrder" | "sameSigner" | "alreadySigned" };

/**
 * Megmondja, hogy a következő aláírás érvényes-e.
 * Szabályok: kötött sorrend; ugyanaz a dolgozó nem írhat alá két szerepben
 * (az átadó nem veheti át saját magától a szolgálatot).
 */
export function checkNextSignature(
  flow: readonly SignatureStep[],
  existing: readonly ExistingSignature[],
  next: ExistingSignature,
): SignCheck {
  if (existing.length >= flow.length) return { ok: false, reason: "closed" };
  if (existing.some((s) => s.role === next.role)) return { ok: false, reason: "alreadySigned" };
  const step = flow[existing.length];
  if (!step || step.role !== next.role) return { ok: false, reason: "wrongOrder" };
  if (existing.some((s) => s.employeeId === next.employeeId)) {
    return { ok: false, reason: "sameSigner" };
  }
  return { ok: true, step };
}

export function statusFromSignatures(
  flow: readonly SignatureStep[],
  existing: readonly ExistingSignature[],
): RecordStatus {
  if (existing.length === 0) return "draft";
  const last = flow[Math.min(existing.length, flow.length) - 1];
  return last ? last.reachesStatus : "draft";
}

/** Aláírás után a rekord tartalma nem módosítható (helyesbítés kell). */
export function isEditable(status: RecordStatus): boolean {
  return status === "draft";
}
