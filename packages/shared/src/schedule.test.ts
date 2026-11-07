import { describe, expect, it } from "vitest";
import { MERT_DEFAULT_SCHEDULE, scheduleConfigSchema, slotLength } from "./schedule.js";

describe("beosztás-konfiguráció", () => {
  it("a MERT alapbeállítása érvényes", () => {
    expect(scheduleConfigSchema.safeParse(MERT_DEFAULT_SCHEDULE).success).toBe(true);
  });

  it("éjfélen átnyúló sáv hossza helyes", () => {
    expect(slotLength({ from: "23:00", to: "03:00" })).toBe(240);
    expect(slotLength({ from: "07:00", to: "19:00" })).toBe(720);
  });

  it("12 órás váltás is beállítható", () => {
    const cfg = {
      system: "24h",
      positions: [{ code: "O1", kind: "post", label: "1. őrhely" }],
      slots: [
        { from: "07:00", to: "19:00" },
        { from: "19:00", to: "07:00" },
      ],
    };
    expect(scheduleConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it("hiányos napot elutasít 24 órás rendszerben", () => {
    const cfg = { ...MERT_DEFAULT_SCHEDULE, slots: MERT_DEFAULT_SCHEDULE.slots.slice(0, 5) };
    expect(scheduleConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it("ismétlődő pozíciókódot elutasít", () => {
    const cfg = {
      ...MERT_DEFAULT_SCHEDULE,
      positions: [...MERT_DEFAULT_SCHEDULE.positions, { code: "J1", kind: "patrol", label: "dupla" }],
    };
    expect(scheduleConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it("hézagos sávokat elutasít", () => {
    const cfg = {
      system: "office",
      positions: [{ code: "O1", kind: "post", label: "1. őrhely" }],
      slots: [
        { from: "08:00", to: "12:00" },
        { from: "13:00", to: "16:00" },
      ],
    };
    expect(scheduleConfigSchema.safeParse(cfg).success).toBe(false);
  });
});
