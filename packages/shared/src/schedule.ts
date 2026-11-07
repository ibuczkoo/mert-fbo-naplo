import { z } from "zod";

/**
 * A beosztás szerkezete objektumonként beállítható (nem kód):
 * hány őrhely és járőr van, és milyen idősávokra oszlik a nap.
 * Az MSZSZ 11/a) függeléke 9 őrhelyet és 5 járőrt, I. és II. váltást ír,
 * a MERT 4 járőrrel, 3 őrhellyel és 6 négyórás sávval dolgozik – ezt mindkettő lefedi.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Időpont ÓÓ:PP formában");

export const timeSlotSchema = z.object({
  from: hhmm,
  to: hhmm,
});
export type TimeSlot = z.infer<typeof timeSlotSchema>;

export const dutyPositionSchema = z.object({
  /** Stabil kód, ezt tárolja a beosztás (pl. "J1", "O2"). */
  code: z.string().regex(/^[A-Z]\d{1,2}$/),
  kind: z.enum(["patrol", "post"]),
  label: z.string().min(1).max(60),
});
export type DutyPosition = z.infer<typeof dutyPositionSchema>;

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Egy sáv hossza percben; éjfélen átnyúló sávot is kezel (23:00–03:00 = 240). */
export function slotLength(slot: TimeSlot): number {
  const d = minutes(slot.to) - minutes(slot.from);
  return d > 0 ? d : d + 24 * 60;
}

export const scheduleConfigSchema = z
  .object({
    system: z.enum(["24h", "office"]),
    positions: z.array(dutyPositionSchema).min(1),
    slots: z.array(timeSlotSchema).min(1),
  })
  .superRefine((cfg, ctx) => {
    const codes = new Set<string>();
    for (const p of cfg.positions) {
      if (codes.has(p.code)) {
        ctx.addIssue({ code: "custom", message: `Ismétlődő kód: ${p.code}`, path: ["positions"] });
      }
      codes.add(p.code);
    }
    for (let i = 1; i < cfg.slots.length; i++) {
      if (cfg.slots[i - 1]?.to !== cfg.slots[i]?.from) {
        ctx.addIssue({ code: "custom", message: `A(z) ${i + 1}. sáv nem csatlakozik az előzőhöz`, path: ["slots", i] });
      }
    }
    if (cfg.system === "24h") {
      const total = cfg.slots.reduce((s, x) => s + slotLength(x), 0);
      if (total !== 24 * 60) {
        ctx.addIssue({ code: "custom", message: "24 órás rendszerben a sávoknak a teljes napot le kell fedniük", path: ["slots"] });
      }
    }
  });
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

/** A MERT mai beosztási szerkezete (a 2026-os Szolgálati napló alapján). */
export const MERT_DEFAULT_SCHEDULE: ScheduleConfig = {
  system: "24h",
  positions: [
    { code: "J1", kind: "patrol", label: "1. járőr" },
    { code: "J2", kind: "patrol", label: "2. járőr" },
    { code: "J3", kind: "patrol", label: "3. járőr" },
    { code: "J4", kind: "patrol", label: "4. járőr" },
    { code: "O1", kind: "post", label: "1. őrhely" },
    { code: "O2", kind: "post", label: "2. őrhely" },
    { code: "O3", kind: "post", label: "3. őrhely" },
  ],
  slots: [
    { from: "07:00", to: "11:00" },
    { from: "11:00", to: "15:00" },
    { from: "15:00", to: "19:00" },
    { from: "19:00", to: "23:00" },
    { from: "23:00", to: "03:00" },
    { from: "03:00", to: "07:00" },
  ],
};
