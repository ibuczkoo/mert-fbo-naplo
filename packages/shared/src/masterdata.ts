import { z } from "zod";
import { employeeInputSchema } from "./employee.js";

/**
 * Törzsadatok: dolgozók, eszközök, fegyverek, kapuk, esemény-kategóriák.
 * Törölni nem lehet őket (a régi naplók hivatkoznak rájuk), csak inaktiválni.
 */

export const EQUIPMENT_KINDS = ["gumibot", "gazspray", "bilincs", "jelveny", "egyeb"] as const;
export const EQUIPMENT_KIND_LABELS: Record<(typeof EQUIPMENT_KINDS)[number], string> = {
  gumibot: "Gumibot",
  gazspray: "Gázspray",
  bilincs: "Bilincs",
  jelveny: "Szolgálati jelvény",
  egyeb: "Egyéb",
};

export const WEAPON_KINDS = ["pisztoly", "gepkarabely"] as const;
export const WEAPON_KIND_LABELS: Record<(typeof WEAPON_KINDS)[number], string> = {
  pisztoly: "Pisztoly",
  gepkarabely: "Gépkarabély",
};

const serial = z.string().trim().min(1, "Adja meg a számot").max(40);

export const equipmentInputSchema = z.object({
  kind: z.enum(EQUIPMENT_KINDS),
  serial,
  active: z.boolean().default(true),
});

export const weaponInputSchema = z.object({
  model: z.string().trim().min(2, "Adja meg a típust").max(60),
  kind: z.enum(WEAPON_KINDS),
  serial,
  storage: z.string().trim().max(120).nullable().default(null),
  active: z.boolean().default(true),
});

export const gateInputSchema = z.object({
  name: z.string().trim().min(1, "Adja meg a kapu nevét").max(80),
  active: z.boolean().default(true),
});

export const incidentCategoryInputSchema = z.object({
  name: z.string().trim().min(2, "Adja meg a kategória nevét").max(120),
  active: z.boolean().default(true),
});

/** Az entitások egységes leírása: a szerver és a felület ugyanebből dolgozik. */
export const MASTER_DATA = {
  employee: { path: "employees", label: "Dolgozók", schema: employeeInputSchema },
  equipment: { path: "equipment", label: "Eszközök", schema: equipmentInputSchema },
  weapon: { path: "weapons", label: "Fegyverek", schema: weaponInputSchema },
  gate: { path: "gates", label: "Kapuk", schema: gateInputSchema },
  incidentCategory: { path: "incident-categories", label: "Esemény-kategóriák", schema: incidentCategoryInputSchema },
} as const;
export type MasterDataKind = keyof typeof MASTER_DATA;
export const MASTER_DATA_KINDS = Object.keys(MASTER_DATA) as MasterDataKind[];

export type MasterDataInput<K extends MasterDataKind> = z.infer<(typeof MASTER_DATA)[K]["schema"]>;
export type MasterDataRecord<K extends MasterDataKind> = MasterDataInput<K> & { id: string };

/** Offline működéshez a készülékre letöltött törzsadat-csomag. */
export interface BootstrapPayload {
  generatedAt: string;
  site: { id: string; name: string; timezone: string; settings: unknown };
  employees: MasterDataRecord<"employee">[];
  equipment: MasterDataRecord<"equipment">[];
  weapons: MasterDataRecord<"weapon">[];
  gates: MasterDataRecord<"gate">[];
  incidentCategories: MasterDataRecord<"incidentCategory">[];
}
