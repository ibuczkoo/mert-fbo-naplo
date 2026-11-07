import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { MERT_DEFAULT_SCHEDULE, passwordPolicySchema } from "@fbo/shared";
import { hashPassword } from "../auth/password.js";
import * as schema from "./schema.js";

type Log = { info: (msg: string) => void; error: (msg: string) => void };

/**
 * Indításkori adatbázis-előkészítés, hogy a tárhelyen ne kelljen terminál:
 *  1. lefuttatja a még nem alkalmazott migrációkat
 *  2. ha még egyetlen felhasználó sincs, létrehozza az objektumot és az első admint
 * Több párhuzamosan induló folyamat (Passenger) esetén egy adatbázis-zár biztosítja,
 * hogy egyszerre csak egy dolgozzon.
 */
export async function prepareDatabase(opts: {
  databaseUrl: string;
  migrationsFolder: string;
  siteName: string;
  initialAdmin?: { username: string; password: string } | undefined;
  log: Log;
}): Promise<void> {
  const conn = await mysql.createConnection({ uri: opts.databaseUrl, multipleStatements: true, timezone: "Z" });
  try {
    const [rows] = await conn.query("SELECT GET_LOCK('fbo_setup', 60) AS ok");
    if ((rows as Array<{ ok: number }>)[0]?.ok !== 1) throw new Error("Nem sikerült megszerezni a telepítési zárat");
    try {
      const db = drizzle(conn, { schema, mode: "default" });
      await migrate(db, { migrationsFolder: opts.migrationsFolder });
      opts.log.info("Adatbázis-migrációk rendben.");

      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(schema.userAccount);
      if (n > 0) return;

      if (!opts.initialAdmin) {
        opts.log.error("Még nincs felhasználó. Állítsa be az INITIAL_ADMIN_USERNAME és INITIAL_ADMIN_PASSWORD változót.");
        return;
      }
      const policy = passwordPolicySchema.safeParse(opts.initialAdmin.password);
      if (!policy.success) {
        opts.log.error("Az INITIAL_ADMIN_PASSWORD túl gyenge: " + policy.error.issues.map((i) => i.message).join(", "));
        return;
      }

      let site = (await db.select().from(schema.site).where(eq(schema.site.name, opts.siteName)).limit(1))[0];
      if (!site) {
        site = {
          id: randomUUID(),
          name: opts.siteName,
          timezone: "Europe/Budapest",
          settings: { schedule: MERT_DEFAULT_SCHEDULE, retentionYears: 5 },
          createdAt: new Date(),
        };
        await db.insert(schema.site).values(site);
      }
      await db.insert(schema.userAccount).values({
        id: randomUUID(),
        siteId: site.id,
        username: opts.initialAdmin.username,
        passwordHash: await hashPassword(opts.initialAdmin.password),
        role: "admin",
        employeeId: null,
        active: true,
        createdAt: new Date(),
      });
      opts.log.info(`Első adminisztrátor létrehozva: ${opts.initialAdmin.username}. A jelszó-változó most törölhető.`);
    } finally {
      await conn.query("SELECT RELEASE_LOCK('fbo_setup')");
    }
  } finally {
    await conn.end();
  }
}
