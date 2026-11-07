import { randomUUID } from "node:crypto";
import { MERT_DEFAULT_SCHEDULE, type Role } from "@fbo/shared";
import { SESSION_COOKIE, buildApp } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { createMemoryStore } from "../store/memory.js";

export const PASSWORD = "Titkos-jelszo-123";

/** Tesztkörnyezet memóriabeli tárolóval, állítható órával és kész felhasználókkal. */
export async function setup() {
  const store = createMemoryStore();
  const siteId = randomUUID();
  store._addSite({ id: siteId, name: "MERT", timezone: "Europe/Budapest", settings: { schedule: MERT_DEFAULT_SCHEDULE } });
  let clock = new Date("2026-11-07T10:00:00Z");
  const app = await buildApp({ store, sessionHours: 12, secureCookies: true, now: () => clock });
  const hash = await hashPassword(PASSWORD);

  const mkUser = async (username: string, role: Role) => {
    const id = randomUUID();
    await store.users.create({ id, siteId, username, passwordHash: hash, role, employeeId: null, active: true });
    return id;
  };
  const login = async (username: string, password = PASSWORD) => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password } });
    const c = res.cookies.find((x) => x.name === SESSION_COOKIE);
    return { res, cookie: c ? { [SESSION_COOKIE]: c.value } : undefined, raw: c };
  };
  /** Bejelentkezett kérés-segéd. */
  const as = async (username: string) => {
    const { cookie } = await login(username);
    return (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) =>
      app.inject({ method, url, payload: payload as never, cookies: cookie });
  };

  return {
    app,
    store,
    siteId,
    mkUser,
    login,
    as,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  };
}
