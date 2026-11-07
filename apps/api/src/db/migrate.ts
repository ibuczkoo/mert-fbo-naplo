import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { loadConfig } from "../config.js";

/** Lefuttatja a még nem alkalmazott adatbázis-migrációkat (apps/api/migrations). */
const config = loadConfig();
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../migrations");

const conn = await mysql.createConnection({ uri: config.DATABASE_URL, multipleStatements: true });
await migrate(drizzle(conn), { migrationsFolder });
await conn.end();
console.log("Migrációk lefutottak.");
