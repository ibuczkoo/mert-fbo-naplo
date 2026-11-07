import type { AuditEntry, EmployeeRecord, SessionRecord, Store, UserRecord } from "./types.js";

/** Memóriabeli tároló a tesztekhez. Ugyanazt a szerződést teljesíti, mint az SQL-es. */
export function createMemoryStore() {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const employees = new Map<string, EmployeeRecord>();
  const audit: Array<AuditEntry & { id: string; at: Date }> = [];

  const store: Store & { _audit: typeof audit } = {
    _audit: audit,
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
    employees: {
      async list(siteId, opts) {
        return [...employees.values()]
          .filter((e) => e.siteId === siteId && (opts?.includeInactive || e.active))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "hu"));
      },
      async findById(id) {
        return employees.get(id) ?? null;
      },
      async findByBadge(siteId, badge) {
        return [...employees.values()].find((e) => e.siteId === siteId && e.badgeNumber === badge) ?? null;
      },
      async create(e) {
        employees.set(e.id, { ...e });
      },
    },
    audit: {
      async append(entry) {
        audit.push(entry);
      },
    },
    async transaction(fn) {
      return fn(store);
    },
    async close() {},
  };
  return store;
}
