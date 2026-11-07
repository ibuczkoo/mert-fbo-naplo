import { describe, expect, it } from "vitest";
import { HANDOVER_FLOW, checkNextSignature, isEditable, statusFromSignatures } from "./lifecycle.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("átadás-átvételi életciklus", () => {
  it("piszkozatból indul és szerkeszthető", () => {
    expect(statusFromSignatures(HANDOVER_FLOW, [])).toBe("draft");
    expect(isEditable("draft")).toBe(true);
  });

  it("aláírásonként lép előre, a harmadik után lezárt", () => {
    const sigs = [
      { role: "atado" as const, employeeId: A },
      { role: "atvevo" as const, employeeId: B },
      { role: "ellenorzo" as const, employeeId: C },
    ];
    expect(statusFromSignatures(HANDOVER_FLOW, sigs.slice(0, 1))).toBe("handedOver");
    expect(statusFromSignatures(HANDOVER_FLOW, sigs.slice(0, 2))).toBe("takenOver");
    expect(statusFromSignatures(HANDOVER_FLOW, sigs)).toBe("closed");
    expect(isEditable("handedOver")).toBe(false);
    expect(isEditable("closed")).toBe(false);
  });

  it("kötött sorrend: átvevő nem írhat alá az átadó előtt", () => {
    const r = checkNextSignature(HANDOVER_FLOW, [], { role: "atvevo", employeeId: B });
    expect(r).toEqual({ ok: false, reason: "wrongOrder" });
  });

  it("az átadó nem veheti át saját magától a szolgálatot", () => {
    const r = checkNextSignature(HANDOVER_FLOW, [{ role: "atado", employeeId: A }], {
      role: "atvevo",
      employeeId: A,
    });
    expect(r).toEqual({ ok: false, reason: "sameSigner" });
  });

  it("ugyanabban a szerepben kétszer nem lehet aláírni", () => {
    const r = checkNextSignature(HANDOVER_FLOW, [{ role: "atado", employeeId: A }], {
      role: "atado",
      employeeId: B,
    });
    expect(r).toEqual({ ok: false, reason: "alreadySigned" });
  });

  it("lezárt rekordot nem lehet tovább aláírni", () => {
    const all = [
      { role: "atado" as const, employeeId: A },
      { role: "atvevo" as const, employeeId: B },
      { role: "ellenorzo" as const, employeeId: C },
    ];
    expect(checkNextSignature(HANDOVER_FLOW, all, { role: "ellenorzo", employeeId: C })).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  it("az ellenőrző aláíráshoz parancsnoki jog kell", () => {
    const r = checkNextSignature(
      HANDOVER_FLOW,
      [
        { role: "atado", employeeId: A },
        { role: "atvevo", employeeId: B },
      ],
      { role: "ellenorzo", employeeId: C },
    );
    expect(r.ok && r.step.requires).toBe("record.signCheck");
  });
});
