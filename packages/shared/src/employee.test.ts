import { describe, expect, it } from "vitest";
import { employeeInputSchema, parseLegacyName } from "./employee.js";

describe("régi névformátum bontása", () => {
  it("név + jelvényszám", () => {
    expect(parseLegacyName("Berencsi János 94016")).toEqual({
      fullName: "Berencsi János",
      badgeNumber: "94016",
    });
  });

  it("a névben lévő szám megmarad, csak az utolsó csoport a jelvény", () => {
    expect(parseLegacyName("Forgó Milán 222 98228")).toEqual({
      fullName: "Forgó Milán 222",
      badgeNumber: "98228",
    });
  });

  it("jelvényszám nélküli név", () => {
    expect(parseLegacyName("  Kovács   Tibor ")).toEqual({ fullName: "Kovács Tibor", badgeNumber: null });
  });

  it("üres és helykitöltő értékek", () => {
    expect(parseLegacyName("Válasszon!")).toBeNull();
    expect(parseLegacyName("")).toBeNull();
    expect(parseLegacyName(undefined)).toBeNull();
    expect(parseLegacyName("-")).toBeNull();
  });
});

describe("dolgozó validáció", () => {
  it("elfogad érvényes adatot", () => {
    expect(employeeInputSchema.parse({ fullName: "Dobos András", badgeNumber: "88400" })).toEqual({
      fullName: "Dobos András",
      badgeNumber: "88400",
      active: true,
    });
  });

  it("elutasítja a hibás jelvényszámot", () => {
    expect(employeeInputSchema.safeParse({ fullName: "Dobos András", badgeNumber: "88A00" }).success).toBe(
      false,
    );
  });
});
