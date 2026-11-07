import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setup } from "./test/helpers.js";

describe("törzsadatok", () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    t = await setup();
    await t.mkUser("parancsnok", "parancsnok");
    await t.mkUser("orpk", "orparancsnok");
    await t.mkUser("or", "or");
  });
  afterEach(async () => t.app.close());

  it("fegyver felvétele, egyedi sorozatszám, inaktiválás", async () => {
    const pk = await t.as("parancsnok");
    const created = await pk("POST", "/api/weapons", { model: "HK USP", kind: "pisztoly", serial: "24-123456" });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    expect(created.json()).toEqual({ id, model: "HK USP", kind: "pisztoly", serial: "24-123456", storage: null, active: true });

    const dup = await pk("POST", "/api/weapons", { model: "Glock 17", kind: "pisztoly", serial: " 24-123456 " });
    expect(dup.statusCode).toBe(409);

    const off = await pk("PATCH", `/api/weapons/${id}`, { active: false });
    expect(off.statusCode).toBe(200);
    expect(off.json().active).toBe(false);

    expect((await pk("GET", "/api/weapons")).json()).toEqual([]);
    expect((await pk("GET", "/api/weapons?all=1")).json()).toHaveLength(1);
  });

  it("az inaktiválás és a módosítás naplózódik, előtte–utána értékkel", async () => {
    const pk = await t.as("parancsnok");
    const { id } = (await pk("POST", "/api/gates", { name: "14. sz. kapu" })).json();
    await pk("PATCH", `/api/gates/${id}`, { name: "14-es kapu" });
    const upd = t.store._audit.find((a) => a.entity === "gate" && a.action === "update");
    expect(upd?.before).toMatchObject({ name: "14. sz. kapu" });
    expect(upd?.after).toEqual({ name: "14-es kapu" });
  });

  it("azonos típusú eszközből nem lehet két azonos szám, eltérő típusból igen", async () => {
    const pk = await t.as("parancsnok");
    expect((await pk("POST", "/api/equipment", { kind: "gumibot", serial: "12" })).statusCode).toBe(201);
    expect((await pk("POST", "/api/equipment", { kind: "bilincs", serial: "12" })).statusCode).toBe(201);
    expect((await pk("POST", "/api/equipment", { kind: "gumibot", serial: "12" })).statusCode).toBe(409);
  });

  it("az őr és az őrparancsnok lát, de nem módosít; az inaktívakat nem kérheti le", async () => {
    const pk = await t.as("parancsnok");
    await pk("POST", "/api/gates", { name: "Főkapu" });
    for (const user of ["or", "orpk"]) {
      const req = await t.as(user);
      expect((await req("GET", "/api/gates")).json()).toHaveLength(1);
      expect((await req("POST", "/api/gates", { name: "Új" })).statusCode).toBe(403);
      expect((await req("GET", "/api/gates?all=1")).statusCode).toBe(403);
    }
  });

  it("más objektum rekordja nem módosítható", async () => {
    const pk = await t.as("parancsnok");
    await t.store.masterData.create("gate", { id: "9b1c2d3e-0000-4000-8000-000000000001", siteId: "masik", name: "Idegen", active: true });
    expect((await pk("PATCH", "/api/gates/9b1c2d3e-0000-4000-8000-000000000001", { name: "x" })).statusCode).toBe(404);
  });

  it("bootstrap: az objektum és minden aktív törzsadat egy csomagban", async () => {
    const pk = await t.as("parancsnok");
    await pk("POST", "/api/employees", { fullName: "Dobos András", badgeNumber: "88400" });
    await pk("POST", "/api/gates", { name: "Főkapu" });
    const off = (await pk("POST", "/api/gates", { name: "Régi kapu" })).json();
    await pk("PATCH", `/api/gates/${off.id}`, { active: false });

    const or = await t.as("or");
    const b = (await or("GET", "/api/bootstrap")).json();
    expect(b.site.name).toBe("MERT");
    expect(b.site.settings.schedule.slots).toHaveLength(6);
    expect(b.employees.map((e: { fullName: string }) => e.fullName)).toEqual(["Dobos András"]);
    expect(b.gates.map((g: { name: string }) => g.name)).toEqual(["Főkapu"]);
    expect(b.weapons).toEqual([]);
    expect(JSON.stringify(b)).not.toContain("siteId");
  });
});
