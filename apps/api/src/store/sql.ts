import { and, asc, eq, lte, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { MasterDataKind } from "@fbo/shared";
import * as schema from "../db/schema.js";
import { sortMasterData } from "../masterdata.js";
import type { Store, StoredMasterData } from "./types.js";

type Db = MySql2Database<typeof schema>;

const MD_TABLES = {
  employee: schema.employee,
  equipment: schema.equipmentItem,
  weapon: schema.weapon,
  gate: schema.gate,
  incidentCategory: schema.incidentCategory,
} as const;

/** Egy törzsadat-sor a publikus alakjára hozva (időbélyeg nélkül). */
function toRecord<K extends MasterDataKind>(row: Record<string, unknown>): StoredMasterData<K> {
  const { createdAt: _c, ...rest } = row;
  return rest as StoredMasterData<K>;
}

function build(db: Db, pool: mysql.Pool | null): Store {
  const store: Store = {
    sites: {
      async findById(id) {
        const rows = await db.select().from(schema.site).where(eq(schema.site.id, id)).limit(1);
        const r = rows[0];
        return r ? { id: r.id, name: r.name, timezone: r.timezone, settings: r.settings } : null;
      },
    },
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
      async list(siteId) {
        return db
          .select()
          .from(schema.userAccount)
          .where(eq(schema.userAccount.siteId, siteId))
          .orderBy(asc(schema.userAccount.username));
      },
      async update(id, patch) {
        if (Object.keys(patch).length === 0) return;
        await db.update(schema.userAccount).set(patch).where(eq(schema.userAccount.id, id));
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
      async deleteForUser(userId) {
        await db.delete(schema.session).where(eq(schema.session.userId, userId));
      },
      async deleteExpired(now) {
        const [res] = await db.delete(schema.session).where(lte(schema.session.expiresAt, now));
        return res.affectedRows;
      },
    },
    masterData: {
      async list(kind, siteId, opts) {
        // A táblák szerkezete entitásonként eltér; a közös mezők (id, siteId, active) mindegyikben megvannak.
        const t = MD_TABLES[kind] as typeof schema.gate;
        const where = opts?.includeInactive ? eq(t.siteId, siteId) : and(eq(t.siteId, siteId), eq(t.active, true));
        const rows = (await db.select().from(t).where(where)) as Record<string, unknown>[];
        return sortMasterData(kind, rows.map((r) => toRecord(r)) as never) as never;
      },
      async findById(kind, id) {
        const t = MD_TABLES[kind] as typeof schema.gate;
        const rows = (await db.select().from(t).where(eq(t.id, id)).limit(1)) as Record<string, unknown>[];
        return (rows[0] ? toRecord(rows[0]) : null) as never;
      },
      async create(kind, rec) {
        const t = MD_TABLES[kind] as typeof schema.gate;
        const hasCreatedAt = "createdAt" in MD_TABLES[kind];
        await db.insert(t).values((hasCreatedAt ? { ...rec, createdAt: new Date() } : rec) as never);
      },
      async update(kind, id, patch) {
        const t = MD_TABLES[kind] as typeof schema.gate;
        const { id: _i, ...rest } = patch as Record<string, unknown>;
        if (Object.keys(rest).length === 0) return;
        await db.update(t).set(rest as never).where(eq(t.id, id));
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
    syncOps: {
      async find(id) {
        const rows = await db.select().from(schema.syncOp).where(eq(schema.syncOp.id, id)).limit(1);
        return rows[0] ?? null;
      },
      async record(op) {
        await db.insert(schema.syncOp).values(op);
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
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 5, timezone: "Z" });
  const db = drizzle(pool, { schema, mode: "default" });
  return build(db, pool);
}
