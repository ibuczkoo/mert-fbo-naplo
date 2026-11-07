import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setup } from "./test/helpers.js";

describe("API alapok", () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    t = await setup();
    await t.mkUser("kovacs.tibor", "parancsnok");
    await t.mkUser("dobos.andras", "or");
    await t.mkUser("admin", "admin");
  });
  afterEach(async () => t.app.close());

  it("health végpont", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("sikeres bejelentkezés biztonságos sütit ad, és a /me visszaadja a felhasználót", async () => {
    const { res, cookie, raw } = await t.login("Kovacs.Tibor");
    expect(res.statusCode).toBe(200);
    expect(raw?.httpOnly).toBe(true);
    expect(raw?.secure).toBe(true);
    expect(raw?.sameSite).toBe("Lax");
    const me = await t.app.inject({ method: "GET", url: "/api/auth/me", cookies: cookie });
    expect(me.json()).toMatchObject({ username: "kovacs.tibor", role: "parancsnok" });
  });

  it("a token nem kerül az adatbázisba, csak a hash-e", async () => {
    const { raw } = await t.login("kovacs.tibor");
    expect(await t.store.sessions.find(raw!.value)).toBeNull();
  });

  it("hibás jelszó: 401, ugyanaz az üzenet, mint nem létező felhasználónál", async () => {
    const a = await t.login("kovacs.tibor", "rossz");
    const b = await t.login("nincs.ilyen", "rossz");
    expect(a.res.statusCode).toBe(401);
    expect(b.res.statusCode).toBe(401);
    expect(a.res.json().error).toBe(b.res.json().error);
  });

  it("5 sikertelen próbálkozás után 429", async () => {
    for (let i = 0; i < 5; i++) await t.login("dobos.andras", "rossz");
    const blocked = await t.login("dobos.andras");
    expect(blocked.res.statusCode).toBe(429);
  });

  it("lejárt munkamenet: 401", async () => {
    const { cookie } = await t.login("dobos.andras");
    t.advance(13 * 3600_000);
    const me = await t.app.inject({ method: "GET", url: "/api/auth/me", cookies: cookie });
    expect(me.statusCode).toBe(401);
  });

  it("kijelentkezés után a süti érvénytelen", async () => {
    const { cookie } = await t.login("dobos.andras");
    await t.app.inject({ method: "POST", url: "/api/auth/logout", cookies: cookie });
    const me = await t.app.inject({ method: "GET", url: "/api/auth/me", cookies: cookie });
    expect(me.statusCode).toBe(401);
  });

  it("a bejelentkezés és a kijelentkezés naplózódik", async () => {
    const { cookie } = await t.login("dobos.andras");
    await t.app.inject({ method: "POST", url: "/api/auth/logout", cookies: cookie });
    expect(t.store._audit.map((a) => a.action)).toEqual(["login", "logout"]);
  });

  it("dolgozó felvétele: parancsnok igen, őr nem, bejelentkezés nélkül nem", async () => {
    const body = { fullName: "Berencsi János", badgeNumber: "94016" };
    const anon = await t.app.inject({ method: "POST", url: "/api/employees", payload: body });
    expect(anon.statusCode).toBe(401);

    const or = await t.login("dobos.andras");
    const denied = await t.app.inject({ method: "POST", url: "/api/employees", payload: body, cookies: or.cookie });
    expect(denied.statusCode).toBe(403);

    const pk = await t.login("kovacs.tibor");
    const ok = await t.app.inject({ method: "POST", url: "/api/employees", payload: body, cookies: pk.cookie });
    expect(ok.statusCode).toBe(201);

    const dup = await t.app.inject({ method: "POST", url: "/api/employees", payload: body, cookies: pk.cookie });
    expect(dup.statusCode).toBe(409);

    const list = await t.app.inject({ method: "GET", url: "/api/employees", cookies: or.cookie });
    expect(list.json()).toEqual([{ id: ok.json().id, fullName: "Berencsi János", badgeNumber: "94016", active: true }]);
    expect(t.store._audit.some((a) => a.entity === "employee" && a.action === "create")).toBe(true);
  });

  it("hibás adat: 400 magyar üzenettel", async () => {
    const pk = await t.login("kovacs.tibor");
    const res = await t.app.inject({
      method: "POST",
      url: "/api/employees",
      payload: { fullName: "X", badgeNumber: "abc" },
      cookies: pk.cookie,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.map((d: { path: string }) => d.path).sort()).toEqual(["badgeNumber", "fullName"]);
  });

  it("ismeretlen API-útvonal: 404", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/nincs" });
    expect(res.statusCode).toBe(404);
  });
});
