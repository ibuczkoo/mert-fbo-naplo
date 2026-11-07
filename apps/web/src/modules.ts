import { can, type Action, type Role } from "@fbo/shared";

export interface ModuleEntry {
  key: string;
  title: string;
  description: string;
  requires: Action;
  /** Melyik fejlesztési fázisban készül el (a 0. fázisban csak a menü látszik). */
  phase: number;
}

export const MODULES: ModuleEntry[] = [
  { key: "shift", title: "Szolgálati napló", description: "Beosztás, átadás-átvétel, aláírások", requires: "shift.view", phase: 1 },
  { key: "issue", title: "Felszerelés- és fegyverkiadás", description: "Kiadás, visszavétel, átvevő aláírása", requires: "issue.manage", phase: 2 },
  { key: "weapons", title: "Fegyverkiadási napló", description: "Melyik fegyver kinél van", requires: "issue.manage", phase: 2 },
  { key: "incident", title: "FBŐ esemény jelentés", description: "Esemény rögzítése, kategorizálás", requires: "incident.create", phase: 3 },
  { key: "seal", title: "Fegyver pecsét", description: "Fegyver- és lőszerkészlet átadása", requires: "weaponSeal.manage", phase: 3 },
  { key: "gate", title: "Kapu nyitás-zárás", description: "Nyitott kapuk, nyitás és zárás rögzítése", requires: "gate.record", phase: 3 },
  { key: "archive", title: "Archívum", description: "Régi bejegyzések keresése és PDF-jei", requires: "archive.read", phase: 4 },
  { key: "masterdata", title: "Törzsadatok", description: "Dolgozók, eszközök, fegyverek, kapuk", requires: "masterData.manage", phase: 0 },
];

export function modulesFor(role: Role): ModuleEntry[] {
  return MODULES.filter((m) => can(role, m.requires));
}
