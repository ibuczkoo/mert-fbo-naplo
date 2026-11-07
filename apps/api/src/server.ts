import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { prepareDatabase } from "./db/setup.js";
import { createSqlStore } from "./store/sql.js";

const config = loadConfig();
const here = path.dirname(fileURLToPath(import.meta.url));

const store = createSqlStore(config.DATABASE_URL);
const app = await buildApp({
  store,
  sessionHours: config.SESSION_HOURS,
  secureCookies: config.NODE_ENV === "production",
  trustProxy: config.TRUST_PROXY,
  webDistDir: config.WEB_DIST_DIR,
  logger: true,
});

if (config.AUTO_MIGRATE) {
  await prepareDatabase({
    databaseUrl: config.DATABASE_URL,
    migrationsFolder: config.MIGRATIONS_DIR ?? path.resolve(here, "../migrations"),
    siteName: config.SITE_NAME,
    initialAdmin:
      config.INITIAL_ADMIN_USERNAME && config.INITIAL_ADMIN_PASSWORD
        ? { username: config.INITIAL_ADMIN_USERNAME, password: config.INITIAL_ADMIN_PASSWORD }
        : undefined,
    log: { info: (m) => app.log.info(m), error: (m) => app.log.error(m) },
  });
}

// Lejárt munkamenetek takarítása óránként.
const cleanup = setInterval(() => {
  store.sessions.deleteExpired(new Date()).catch((err) => app.log.error(err));
}, 3600_000);
cleanup.unref();

const shutdown = async () => {
  await app.close();
  await store.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
