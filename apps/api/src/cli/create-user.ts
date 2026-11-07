import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { MERT_DEFAULT_SCHEDULE, passwordPolicySchema, roleSchema } from "@fbo/shared";
import { hashPassword } from "../auth/password.js";
import { loadConfig } from "../config.js";
import * as schema from "../db/schema.js";

/**
 * Első telepítéskor: objektum + első adminisztrátor létrehozása.
 *   node dist/cli/create-user.js --site "MERT" --username admin --role admin
 * A jelszót a FBO_NEW_PASSWORD környezeti változóból olvassa, hogy ne kerüljön
 * a parancssori előzményekbe.
 */
const { values } = parseArgs({
  options: {
    site: { type: "string", default: "MERT" },
    username: { type: "string" },
    role: { type: "string", default: "admin" },
  },
});

const password = process.env.FBO_NEW_PASSWORD;
if (!values.username || !password) {
  console.error("Használat: FBO_NEW_PASSWORD=... node dist/cli/create-user.js --username <név> [--role admin]");
  process.exit(1);
}
const policy = passwordPolicySchema.safeParse(password);
if (!policy.success) {
  console.error("A jelszó nem elég erős: " + policy.error.issues.map((i) => i.message).join(", "));
  process.exit(1);
}
const role = roleSchema.parse(values.role);
const config = loadConfig();
const conn = await mysql.createConnection({ uri: config.DATABASE_URL });
const db = drizzle(conn, { schema, mode: "default" });

let site = (await db.select().from(schema.site).where(eq(schema.site.name, values.site!)).limit(1))[0];
if (!site) {
  const s = {
    id: randomUUID(),
    name: values.site!,
    timezone: "Europe/Budapest",
    settings: { schedule: MERT_DEFAULT_SCHEDULE, retentionYears: 5 },
    createdAt: new Date(),
  };
  await db.insert(schema.site).values(s);
  site = s;
  console.log(`Objektum létrehozva: ${s.name}`);
}

await db.insert(schema.userAccount).values({
  id: randomUUID(),
  siteId: site.id,
  username: values.username,
  passwordHash: await hashPassword(password),
  role,
  employeeId: null,
  active: true,
  createdAt: new Date(),
});
console.log(`Felhasználó létrehozva: ${values.username} (${role})`);
await conn.end();
