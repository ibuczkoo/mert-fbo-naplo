import { EQUIPMENT_KIND_LABELS, WEAPON_KIND_LABELS, type MasterDataKind } from "@fbo/shared";

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "select";
  options?: Record<string, string>;
  optional?: boolean;
  placeholder?: string;
}

export const FIELDS: Record<MasterDataKind, FieldDef[]> = {
  employee: [
    { name: "fullName", label: "Név", type: "text", placeholder: "pl. Dobos András" },
    { name: "badgeNumber", label: "Jelvényszám", type: "text", optional: true, placeholder: "pl. 88400" },
  ],
  equipment: [
    { name: "kind", label: "Típus", type: "select", options: EQUIPMENT_KIND_LABELS },
    { name: "serial", label: "Szám", type: "text", placeholder: "pl. 12" },
  ],
  weapon: [
    { name: "model", label: "Típus", type: "text", placeholder: "pl. HK USP" },
    { name: "kind", label: "Fajta", type: "select", options: WEAPON_KIND_LABELS },
    { name: "serial", label: "Sorozatszám", type: "text" },
    { name: "storage", label: "Tárolóhely", type: "text", optional: true },
  ],
  gate: [{ name: "name", label: "Megnevezés", type: "text", placeholder: "pl. 14. sz. kapu" }],
  incidentCategory: [{ name: "name", label: "Megnevezés", type: "text" }],
};

/** Egy sor rövid, emberi megnevezése a listákhoz. */
export function rowTitle(kind: MasterDataKind, r: Record<string, unknown>): string {
  switch (kind) {
    case "employee":
      return String(r.fullName);
    case "equipment":
      return `${EQUIPMENT_KIND_LABELS[r.kind as keyof typeof EQUIPMENT_KIND_LABELS] ?? r.kind} – ${r.serial}`;
    case "weapon":
      return `${r.model} – ${r.serial}`;
    default:
      return String(r.name);
  }
}

export function rowSubtitle(kind: MasterDataKind, r: Record<string, unknown>): string | null {
  switch (kind) {
    case "employee":
      return r.badgeNumber ? `Jelvényszám: ${r.badgeNumber}` : "Nincs jelvényszám";
    case "weapon":
      return [WEAPON_KIND_LABELS[r.kind as keyof typeof WEAPON_KIND_LABELS], r.storage].filter(Boolean).join(" · ");
    default:
      return null;
  }
}

/** Az űrlap szöveges értékeiből a séma szerinti bemenet (üres opcionális mező = null). */
export function toInput(kind: MasterDataKind, values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[kind]) {
    const v = (values[f.name] ?? "").trim();
    out[f.name] = f.optional && v === "" ? null : v;
  }
  return out;
}
