import {
  boolean,
  char,
  datetime,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { ROLES } from "@fbo/shared";

/**
 * 0. fázis: törzsadatok, felhasználók, munkamenetek, audit, szinkron.
 * Az azonosítók UUID-k (char(36)), mert a tableten offline létrehozott
 * rekordnak is már a készüléken kell azonosító.
 * Minden üzleti tábla hordoz site_id-t (objektum), így később több
 * telephely vagy ügyfél is befér egy adatbázisba.
 * A dátum-idők UTC-ben tárolódnak; a megjelenítés a site időzónájában történik.
 */

const id = () => char("id", { length: 36 }).primaryKey();
const siteId = () => char("site_id", { length: 36 }).notNull();
const createdAt = () => datetime("created_at", { mode: "date", fsp: 3 }).notNull();

export const site = mysqlTable("site", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Europe/Budapest"),
  /** Beosztás-konfiguráció (ScheduleConfig) és megőrzési idők modulonként. */
  settings: json("settings").notNull(),
  createdAt: createdAt(),
});

export const employee = mysqlTable(
  "employee",
  {
    id: id(),
    siteId: siteId(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    badgeNumber: varchar("badge_number", { length: 6 }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("employee_site_idx").on(t.siteId, t.active),
    uniqueIndex("employee_badge_uq").on(t.siteId, t.badgeNumber),
  ],
);

export const userAccount = mysqlTable(
  "user_account",
  {
    id: id(),
    siteId: siteId(),
    username: varchar("username", { length: 120 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: mysqlEnum("role", ROLES).notNull(),
    employeeId: char("employee_id", { length: 36 }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("user_username_uq").on(t.username)],
);

export const session = mysqlTable(
  "session",
  {
    /** A süti tokenjének SHA-256 hash-e; maga a token sosem kerül az adatbázisba. */
    tokenHash: char("token_hash", { length: 64 }).primaryKey(),
    userId: char("user_id", { length: 36 }).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: createdAt(),
    userAgent: varchar("user_agent", { length: 255 }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const auditLog = mysqlTable(
  "audit_log",
  {
    id: id(),
    siteId: siteId(),
    at: datetime("at", { mode: "date", fsp: 3 }).notNull(),
    userId: char("user_id", { length: 36 }),
    entity: varchar("entity", { length: 64 }).notNull(),
    entityId: char("entity_id", { length: 36 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    before: json("before"),
    after: json("after"),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_at_idx").on(t.siteId, t.at)],
);

/** A készülékről érkezett szinkron-műveletek: kétszer beküldött művelet se rögzüljön kétszer. */
export const syncOp = mysqlTable("sync_op", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: char("user_id", { length: 36 }).notNull(),
  receivedAt: datetime("received_at", { mode: "date", fsp: 3 }).notNull(),
  result: json("result"),
});

export const equipmentItem = mysqlTable(
  "equipment_item",
  {
    id: id(),
    siteId: siteId(),
    kind: mysqlEnum("kind", ["gumibot", "gazspray", "bilincs", "jelveny", "egyeb"]).notNull(),
    serial: varchar("serial", { length: 40 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("equipment_serial_uq").on(t.siteId, t.kind, t.serial)],
);

export const weapon = mysqlTable(
  "weapon",
  {
    id: id(),
    siteId: siteId(),
    model: varchar("model", { length: 60 }).notNull(),
    kind: mysqlEnum("kind", ["pisztoly", "gepkarabely"]).notNull(),
    serial: varchar("serial", { length: 40 }).notNull(),
    storage: varchar("storage", { length: 120 }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("weapon_serial_uq").on(t.siteId, t.serial)],
);

export const gate = mysqlTable("gate", {
  id: id(),
  siteId: siteId(),
  name: varchar("name", { length: 80 }).notNull(),
  active: boolean("active").notNull().default(true),
});

export const incidentCategory = mysqlTable("incident_category", {
  id: id(),
  siteId: siteId(),
  name: varchar("name", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
});
