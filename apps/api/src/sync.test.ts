import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setup } from "./test/helpers.js";

const op = (type: string, payload: unknown, opId = randomUUID()) => ({
  opId,
  type,
  createdAt: "2026-11-07T09:58:00.000Z",
  payload,
});

describe("offline szinkron", () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    t = await setup();
    await t.mkUser("parancsnok", "parancsnok");
    await t.mkUser("or", "or");
  });
  afterEach(async () => t.app.close());

  it("a műveletet végrehajtja, és a művelet azonosítója lesz a rekordé", async () => {
    const pk = await t.as("parancsnok");
    const o = op("masterData.create", { kind: "gate", data: { name: "Főkapu" } });
    const res = (await pk("POST", "/api/sync", { ops: [o] })).json();
    expect(res.results).toEqual([{ opId: o.opId, status: "applied", result: { id: o.opId, name: "Főkapu", active: true } }]);
    expect((await pk("GET", "/api/gates")).json()[0].id).toBe(o.opId);
  });

  it("ismételt beküldésnél nem rögzít kétszer, a korábbi eredményt adja", async () => {
    const pk = await t.as("parancsnok");
    const o = op("masterData.create", { kind: "gate", data: { name: "Főkapu" } });
    await pk("POST", "/api/sync", { ops: [o] });
    const again = (await pk("POST", "/api/sync", { ops: [o] })).json();
    expect(again.results[0].status).toBe("duplicate");
    expect(again.results[0].result.name).toBe("Főkapu");
    expect((await pk("GET", "/api/gates")).json()).toHaveLength(1);
    expect(t.store._audit.filter((a) => a.entity === "gate")).toHaveLength(1);
  });

  it("sorrendben dolgoz fel; a hibás művelet elutasítva, a többi lefut", async () => {
    const pk = await t.as("parancsnok");
    const a = op("masterData.create", { kind: "gate", data: { name: "A kapu" } });
    const bad = op("masterData.create", { kind: "gate", data: { name: "" } });
    const dup = op("masterData.create", { kind: "gate", data: { name: "a kapu" } });
    const unknown = op("nincs.ilyen", {});
    const c = op("masterData.update", { kind: "gate", id: a.opId, data: { name: "A-kapu" } });
    const res = (await pk("POST", "/api/sync", { ops: [a, bad, dup, unknown, c] })).json();
    expect(res.results.map((r: { status: string }) => r.status)).toEqual([
      "applied",
      "rejected",
      "rejected",
      "rejected",
      "applied",
    ]);
    expect(res.results[2].error).toBe("Ilyen nevű kapu már van");
    expect((await pk("GET", "/api/gates")).json().map((g: { name: string }) => g.name)).toEqual(["A-kapu"]);
  });

  it("jogosultság nélkül elutasít, és nem rögzít nyugtát (később se fusson le)", async () => {
    const or = await t.as("or");
    const o = op("masterData.create", { kind: "gate", data: { name: "Főkapu" } });
    const res = (await or("POST", "/api/sync", { ops: [o] })).json();
    expect(res.results[0]).toMatchObject({ status: "rejected", error: "Ehhez nincs jogosultsága" });
    expect(await t.store.syncOps.find(o.opId)).toBeNull();
  });

  it("más felhasználó műveletazonosítóját nem lehet felhasználni", async () => {
    await t.mkUser("parancsnok2", "parancsnok");
    const pk = await t.as("parancsnok");
    const pk2 = await t.as("parancsnok2");
    const o = op("masterData.create", { kind: "gate", data: { name: "Főkapu" } });
    await pk("POST", "/api/sync", { ops: [o] });
    const res = (await pk2("POST", "/api/sync", { ops: [o] })).json();
    expect(res.results[0].status).toBe("rejected");
  });

  it("bejelentkezés nélkül 401, hibás kérés 400", async () => {
    const anon = await t.app.inject({ method: "POST", url: "/api/sync", payload: { ops: [op("x", {})] } });
    expect(anon.statusCode).toBe(401);
    const pk = await t.as("parancsnok");
    expect((await pk("POST", "/api/sync", { ops: [] })).statusCode).toBe(400);
    expect((await pk("POST", "/api/sync", { ops: [{ opId: "nem-uuid", type: "x", createdAt: "x" }] })).statusCode).toBe(400);
  });
});
