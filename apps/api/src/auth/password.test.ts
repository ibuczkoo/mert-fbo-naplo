import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("jelszóhash", () => {
  it("helyes jelszót elfogad, hibásat elutasít", async () => {
    const h = await hashPassword("Ékezetes-jelszó-2026");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Ékezetes-jelszó-2026", h)).toBe(true);
    expect(await verifyPassword("ekezetes-jelszo-2026", h)).toBe(false);
  });

  it("azonos jelszóból eltérő hash (só)", async () => {
    expect(await hashPassword("abc123abc123")).not.toBe(await hashPassword("abc123abc123"));
  });

  it("sérült hash-formátumot elutasít", async () => {
    expect(await verifyPassword("x", "nem-hash")).toBe(false);
  });
});
