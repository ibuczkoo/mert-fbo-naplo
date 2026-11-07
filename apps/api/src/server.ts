import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createSqlStore } from "./store/sql.js";

const config = loadConfig();
const store = createSqlStore(config.DATABASE_URL);

const app = await buildApp({
  store,
  sessionHours: config.SESSION_HOURS,
  secureCookies: config.NODE_ENV === "production",
  trustProxy: config.TRUST_PROXY,
  webDistDir: config.WEB_DIST_DIR,
  logger: true,
});

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
