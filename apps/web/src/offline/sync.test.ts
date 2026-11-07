import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDb, enforceInactivityWipe, wipeLocalData } from "./db";
import { SyncEngine } from "./sync";

type Op = { opId: string; type: string; payload: { name?: string } };

/** Hamis szerver: alkalmazza a műveleteket, elutasítja az üres nevet, idempotens. */
function fakeServer() {
  const applied = new Map<string, unknown>();
  let mode: "ok" | "offline" | "500" | "401" = "ok";
  const calls: Op[][] = [];
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    if (mode === "offline") throw new TypeError("Failed to fetch");
    if (mode === "500") return new Response("{}", { status: 500 });
    if (mode === "401") return new Response("{}", { status: 401 });
    const { ops } = JSON.parse(String(init?.body)) as { ops: Op[] };
    calls.push(ops);
    const results = ops.map((o) => {
      if (applied.has(o.opId)) return { opId: o.opId, status: "duplicate" };
      if (!o.payload.name) return { opId: o.opId, status: "rejected", error: "Adja meg a nevet" };
      applied.set(o.opId, o.payload);
      return { opId: o.opId, status: "applied" };
    });
    return new Response(JSON.stringify({ results }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, applied, calls, setMode: (m: typeof mode) => (mode = m) };
}

describe("szinkronmotor", () => {
  let db: LocalDb;
  let server: ReturnType<typeof fakeServer>;
  let engine: SyncEngine;

  beforeEach(() => {
    db = new LocalDb(`teszt-${crypto.randomUUID()}`);
    server = fakeServer();
    engine = new SyncEngine(db, server.fetchFn, 2);
  });
  afterEach(async () => db.delete());

  it("offline rögzít, majd hálózat esetén sorrendben felküld és kiüríti a sort", async () => {
    server.setMode("offline");
    const ids = [
      await engine.enqueue("gate.create", { name: "A" }),
      await engine.enqueue("gate.create", { name: "B" }),
      await engine.enqueue("gate.create", { name: "C" }),
    ];
    expect(await engine.flush()).toEqual({ kind: "offline" });
    expect(await engine.pendingCount()).toBe(3);
    expect((await db.outbox.get(ids[0]!))?.attempts).toBe(1);

    server.setMode("ok");
    expect(await engine.flush()).toEqual({ kind: "done", applied: 3, rejected: 0 });
    expect(await engine.pendingCount()).toBe(0);
    // kötegméret 2: két hívás, a felvétel sorrendjében
    expect(server.calls.map((c) => c.map((o) => o.payload.name))).toEqual([["A", "B"], ["C"]]);
  });

  it("az elutasított művelet megjelölve marad, a többi lefut, és nem küldi újra", async () => {
    const bad = await engine.enqueue("gate.create", { name: "" });
    await engine.enqueue("gate.create", { name: "Jó" });
    expect(await engine.flush()).toEqual({ kind: "done", applied: 1, rejected: 1 });
    const item = await db.outbox.get(bad);
    expect(item).toMatchObject({ status: "rejected", error: "Adja meg a nevet" });
    expect(await engine.flush()).toEqual({ kind: "idle" });
    expect(server.calls).toHaveLength(1);
    await engine.discard(bad);
    expect(await db.outbox.count()).toBe(0);
  });

  it("ha a válasz elveszett, az újraküldés nem rögzít kétszer", async () => {
    const id = await engine.enqueue("gate.create", { name: "A" });
    server.applied.set(id, { name: "A" }); // a szerver már megkapta, de a válasz nem ért vissza
    expect(await engine.flush()).toEqual({ kind: "done", applied: 1, rejected: 0 });
    expect(server.applied.size).toBe(1);
  });

  it("szerverhiba és lejárt munkamenet esetén a sor érintetlen marad", async () => {
    await engine.enqueue("gate.create", { name: "A" });
    server.setMode("500");
    expect(await engine.flush()).toEqual({ kind: "serverError" });
    server.setMode("401");
    expect(await engine.flush()).toEqual({ kind: "unauthorized" });
    expect(await engine.pendingCount()).toBe(1);
  });

  it("párhuzamos flush nem küld kétszer", async () => {
    await engine.enqueue("gate.create", { name: "A" });
    const [a, b] = await Promise.all([engine.flush(), engine.flush()]);
    expect(a).toEqual(b);
    expect(server.calls).toHaveLength(1);
  });
});

describe("helyi adat törlése", () => {
  it("kijelentkezéskor és 7 nap inaktivitás után törlődik", async () => {
    const db = new LocalDb(`teszt-${crypto.randomUUID()}`);
    const engine = new SyncEngine(db, (async () => new Response("{}")) as unknown as typeof fetch);
    await engine.enqueue("x", {});
    await db.cache.put({ key: "bootstrap", value: {}, updatedAt: "" });
    await wipeLocalData(db);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.cache.count()).toBe(0);

    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const t0 = Date.UTC(2026, 10, 1);
    expect(await enforceInactivityWipe(t0, db)).toBe(false);
    await engine.enqueue("x", {});
    expect(await enforceInactivityWipe(t0 + 3 * 24 * 3600_000, db)).toBe(false);
    expect(await db.outbox.count()).toBe(1);
    expect(await enforceInactivityWipe(t0 + 11 * 24 * 3600_000, db)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    await db.delete();
  });
});
