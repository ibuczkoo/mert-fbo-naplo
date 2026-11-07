import type { MasterDataKind } from "@fbo/shared";
import { sortMasterData } from "../masterdata.js";
import type { AuditEntry, SessionRecord, SiteRecord, Store, StoredMasterData, SyncOpRecord, UserRecord } from "./types.js";

/** Memóriabeli tároló a tesztekhez. Ugyanazt a szerződést teljesíti, mint az SQL-es. */
export function createMemoryStore() {
  const sites = new Map<string, SiteRecord>();
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const md = new Map<MasterDataKind, Map<string, StoredMasterData<MasterDataKind>>>();
  const audit: Array<AuditEntry & { id: string; at: Date }> = [];
  const syncOps = new Map<string, SyncOpRecord>();
  const table = (k: MasterDataKind) => {
    if (!md.has(k)) md.set(k, new Map());
    return md.get(k)!;
  };

  const store: Store & { _audit: typeof audit; _addSite(s: SiteRecord): void } = {
    _audit: audit,
    _addSite: (s) => void sites.set(s.id, s),
    sites: {
      async findById(id) {
        return sites.get(id) ?? null;
      },
    },
    users: {
      async findByUsername(username) {
        const u = username.toLowerCase();
        return [...users.values()].find((x) => x.username.toLowerCase() === u) ?? null;
      },
      async findById(id) {
        return users.get(id) ?? null;
      },
      async create(user) {
        users.set(user.id, { ...user });
      },
    },
    sessions: {
      async create(s) {
        sessions.set(s.tokenHash, { ...s });
      },
      async find(h) {
        return sessions.get(h) ?? null;
      },
      async extend(h, expiresAt) {
        const s = sessions.get(h);
        if (s) s.expiresAt = expiresAt;
      },
      async delete(h) {
        sessions.delete(h);
      },
      async deleteExpired(now) {
        let n = 0;
        for (const [k, s] of sessions) if (s.expiresAt <= now) (sessions.delete(k), n++);
        return n;
      },
    },
    masterData: {
      async list(kind, siteId, opts) {
        const rows = [...table(kind).values()].filter(
          (r) => r.siteId === siteId && (opts?.includeInactive || r.active),
        );
        return sortMasterData(kind, rows.map((r) => ({ ...r })) as never) as never;
      },
      async findById(kind, id) {
        const r = table(kind).get(id);
        return (r ? { ...r } : null) as never;
      },
      async create(kind, rec) {
        table(kind).set(rec.id, { ...rec } as never);
      },
      async update(kind, id, patch) {
        const r = table(kind).get(id);
        if (r) table(kind).set(id, { ...r, ...patch } as never);
      },
    },
    audit: {
      async append(entry) {
        audit.push(entry);
      },
    },
    syncOps: {
      async find(id) {
        return syncOps.get(id) ?? null;
      },
      async record(op) {
        if (syncOps.has(op.id)) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
        syncOps.set(op.id, op);
      },
    },
    async transaction(fn) {
      return fn(store);
    },
    async close() {},
  };
  return store;
}
