import { and, asc, eq, lte, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../db/schema.js";
import type { Store } from "./types.js";

type Db = MySql2Database<typeof schema>;

function build(db: Db, pool: mysql.Pool | null): Store {
  const store: Store = {
    users: {
      async findByUsername(username) {
        const rows = await db
          .select()
          .from(schema.userAccount)
          .where(sql`lower(${schema.userAccount.username}) = ${username.toLowerCase()}`)
          .limit(1);
        return rows[0] ?? null;
      },
      async findById(id) {
        const rows = await db.select().from(schema.userAccount).where(eq(schema.userAccount.id, id)).limit(1);
        return rows[0] ?? null;
      },
      async create(user) {
        await db.insert(schema.userAccount).values({ ...user, createdAt: new Date() });
      },
    },
    sessions: {
      async create(s) {
        await db.insert(schema.session).values({ ...s, createdAt: new Date() });
      },
      async find(tokenHash) {
        const rows = await db.select().from(schema.session).where(eq(schema.session.tokenHash, tokenHash)).limit(1);
        const r = rows[0];
        return r ? { tokenHash: r.tokenHash, userId: r.userId, expiresAt: r.expiresAt, userAgent: r.userAgent } : null;
      },
      async extend(tokenHash, expiresAt) {
        await db.update(schema.session).set({ expiresAt }).where(eq(schema.session.tokenHash, tokenHash));
      },
      async delete(tokenHash) {
        await db.delete(schema.session).where(eq(schema.session.tokenHash, tokenHash));
      },
      async deleteExpired(now) {
        const [res] = await db.delete(schema.session).where(lte(schema.session.expiresAt, now));
        return res.affectedRows;
      },
    },
    employees: {
      async list(siteId, opts) {
        const where = opts?.includeInactive
          ? eq(schema.employee.siteId, siteId)
          : and(eq(schema.employee.siteId, siteId), eq(schema.employee.active, true));
        return db.select().from(schema.employee).where(where).orderBy(asc(schema.employee.fullName));
      },
      async findById(id) {
        const rows = await db.select().from(schema.employee).where(eq(schema.employee.id, id)).limit(1);
        return rows[0] ?? null;
      },
      async findByBadge(siteId, badge) {
        const rows = await db
          .select()
          .from(schema.employee)
          .where(and(eq(schema.employee.siteId, siteId), eq(schema.employee.badgeNumber, badge)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(e) {
        await db.insert(schema.employee).values(e);
      },
    },
    audit: {
      async append(entry) {
        await db.insert(schema.auditLog).values({
          id: entry.id,
          siteId: entry.siteId,
          at: entry.at,
          userId: entry.userId,
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          before: entry.before ?? null,
          after: entry.after ?? null,
        });
      },
    },
    async transaction(fn) {
      return db.transaction(async (tx) => fn(build(tx as unknown as Db, null)));
    },
    async close() {
      await pool?.end();
    },
  };
  return store;
}

export function createSqlStore(databaseUrl: string): Store {
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 5, timezone: "Z", dateStrings: false });
  const db = drizzle(pool, { schema, mode: "default" });
  return build(db, pool);
}
