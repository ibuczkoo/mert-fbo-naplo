import { describe, expect, it } from "vitest";
import { ACTIONS, PERMISSIONS, ROLES, allowedActions, can } from "./permissions.js";

describe("jogosultsági mátrix", () => {
  it("minden művelethez van legalább egy szerepkör", () => {
    for (const action of ACTIONS) {
      expect(PERMISSIONS[action].length, action).toBeGreaterThan(0);
    }
  });

  it("csak ismert szerepköröket használ", () => {
    for (const action of ACTIONS) {
      for (const role of PERMISSIONS[action]) expect(ROLES).toContain(role);
    }
  });

  it("az admin technikai szerep: nem rögzít és nem ír alá", () => {
    expect(can("admin", "shift.edit")).toBe(false);
    expect(can("admin", "record.signCheck")).toBe(false);
    expect(can("admin", "issue.signAsReceiver")).toBe(false);
    expect(can("admin", "incident.create")).toBe(false);
    expect(can("admin", "users.manage")).toBe(true);
  });

  it("ellenőrzőként csak a parancsnok írhat alá", () => {
    expect(ROLES.filter((r) => can(r, "record.signCheck"))).toEqual(["parancsnok"]);
  });

  it("az őr lát, eseményt és kaput rögzít, átvevőként aláír, de kiadást nem kezel", () => {
    expect(allowedActions("or")).toEqual([
      "shift.view",
      "incident.create",
      "issue.signAsReceiver",
      "gate.record",
    ]);
  });

  it("a felhasználókezelés csak adminé", () => {
    expect(ROLES.filter((r) => can(r, "users.manage"))).toEqual(["admin"]);
  });
});
