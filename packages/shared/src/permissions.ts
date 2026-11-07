import { z } from "zod";

/**
 * Szerepkörök. A mai WordPress-szerepkörök megfelelői:
 *  or            ← "FBŐ őr" (fb_r)
 *  orparancsnok  ← "FBŐ Őrparancsnok" (fb_rparancsnok)
 *  parancsnok    ← "Parancsnok"
 *  admin         ← "Adminisztrátor" (technikai szerep: nem rögzít, nem ír alá)
 */
export const ROLES = ["or", "orparancsnok", "parancsnok", "admin"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  or: "Őr",
  orparancsnok: "Őrparancsnok",
  parancsnok: "Parancsnok",
  admin: "Adminisztrátor",
};

/**
 * Műveletek. A jogosultsági táblázat a 2026.11.07-én jóváhagyott terv
 * ("MERT FBŐ napló – architektúra- és adatmodell-terv", Jogosultságok) szerint.
 */
export const ACTIONS = [
  "shift.view",
  "shift.edit",
  "record.signCheck",
  "incident.create",
  "incident.categorize",
  "issue.manage",
  "issue.signAsReceiver",
  "weaponSeal.manage",
  "gate.record",
  "archive.read",
  "masterData.manage",
  "users.manage",
  "retention.approve",
] as const;
export const actionSchema = z.enum(ACTIONS);
export type Action = z.infer<typeof actionSchema>;

const ALL_DUTY: Role[] = ["or", "orparancsnok", "parancsnok"];
const COMMANDERS: Role[] = ["orparancsnok", "parancsnok"];

export const PERMISSIONS: Record<Action, readonly Role[]> = {
  "shift.view": ["or", "orparancsnok", "parancsnok", "admin"],
  "shift.edit": COMMANDERS,
  "record.signCheck": ["parancsnok"],
  "incident.create": ALL_DUTY,
  "incident.categorize": COMMANDERS,
  "issue.manage": COMMANDERS,
  "issue.signAsReceiver": ALL_DUTY,
  "weaponSeal.manage": COMMANDERS,
  "gate.record": ALL_DUTY,
  "archive.read": ["orparancsnok", "parancsnok", "admin"],
  "masterData.manage": ["parancsnok", "admin"],
  "users.manage": ["admin"],
  "retention.approve": ["parancsnok"],
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[action].includes(role);
}

export function allowedActions(role: Role): Action[] {
  return ACTIONS.filter((a) => can(role, a));
}
