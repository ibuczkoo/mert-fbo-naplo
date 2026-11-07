import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setup } from "./test/helpers.js";

describe("felhasználókezelés", () => {
  let t: Awaited<ReturnType<typeof setup>>;
  let adminId: string;
  beforeEach(async () => {
    t = await setup();
    adminId = await t.mkUser("admin", "admin");
    await t.mkUser("parancsnok", "parancsnok");
  });
  afterEach(async () => t.app.close());

  it("az admin felvesz egy őrparancsnokot, aki be tud lépni", async () => {
    const admin = await t.as("admin");
    const res = await admin("POST", "/api/users", { username: "Nagy.Jozsef", role: "orparancsnok", password: "Orpk-jelszo-2026" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ username: "nagy.jozsef", role: "orparancsnok", active: true });
    expect(JSON.stringify(res.json())).not.toContain("password");
    expect((await t.login("nagy.jozsef", "Orpk-jelszo-2026")).res.statusCode).toBe(200);
    const audit = t.store._audit.find((a) => a.entity === "user_account" && a.action === "create");
    expect(JSON.stringify(audit)).not.toContain("Orpk-jelszo-2026");
  });

  it("gyenge jelszó, hibás név és foglalt név elutasítva", async () => {
    const admin = await t.as("admin");
    expect((await admin("POST", "/api/users", { username: "uj.or", role: "or", password: "rovid" })).statusCode).toBe(400);
    expect((await admin("POST", "/api/users", { username: "Új Őr", role: "or", password: "Jo-jelszo-2026" })).statusCode).toBe(400);
    expect((await admin("POST", "/api/users", { username: "PARANCSNOK", role: "or", password: "Jo-jelszo-2026" })).statusCode).toBe(409);
  });

  it("csak az admin kezelhet felhasználót", async () => {
    const pk = await t.as("parancsnok");
    expect((await pk("GET", "/api/users")).statusCode).toBe(403);
    expect((await pk("POST", "/api/users", { username: "x.y", role: "admin", password: "Jo-jelszo-2026" })).statusCode).toBe(403);
  });

  it("tiltás és jelszócsere után a régi munkamenet megszűnik", async () => {
    const admin = await t.as("admin");
    const created = (await admin("POST", "/api/users", { username: "or1", role: "or", password: "Or-jelszo-2026" })).json();
    const or = await t.login("or1", "Or-jelszo-2026");
    const me = () => t.app.inject({ method: "GET", url: "/api/auth/me", cookies: or.cookie });
    expect((await me()).statusCode).toBe(200);
    await admin("PATCH", `/api/users/${created.id}`, { password: "Uj-jelszo-2026" });
    expect((await me()).statusCode).toBe(401);
    expect((await t.login("or1", "Or-jelszo-2026")).res.statusCode).toBe(401);
    expect((await t.login("or1", "Uj-jelszo-2026")).res.statusCode).toBe(200);
    await admin("PATCH", `/api/users/${created.id}`, { active: false });
    expect((await t.login("or1", "Uj-jelszo-2026")).res.statusCode).toBe(401);
  });

  it("az admin nem zárhatja ki saját magát", async () => {
    const admin = await t.as("admin");
    expect((await admin("PATCH", `/api/users/${adminId}`, { active: false })).statusCode).toBe(400);
    expect((await admin("PATCH", `/api/users/${adminId}`, { role: "or" })).statusCode).toBe(400);
  });

  it("dolgozóhoz köthető; nem létező dolgozó elutasítva", async () => {
    const admin = await t.as("admin");
    const emp = (await admin("POST", "/api/employees", { fullName: "Nagy József", badgeNumber: "90001" })).json();
    const ok = await admin("POST", "/api/users", { username: "nagy.j", role: "orparancsnok", password: "Jo-jelszo-2026", employeeId: emp.id });
    expect(ok.statusCode).toBe(201);
    const me = await t.login("nagy.j", "Jo-jelszo-2026");
    expect(me.res.json().employee).toMatchObject({ fullName: "Nagy József", badgeNumber: "90001" });
    const bad = await admin("POST", "/api/users", { username: "x.y", role: "or", password: "Jo-jelszo-2026", employeeId: "00000000-0000-4000-8000-000000000000" });
    expect(bad.statusCode).toBe(400);
  });
});
