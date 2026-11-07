import { z } from "zod";

/**
 * Minden beállítás környezeti változóból jön, így a tárhely cserélhető
 * (cPanel, VPS, Docker) kódmódosítás nélkül.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  /** mysql://felhasznalo:jelszo@localhost:3306/adatbazis */
  DATABASE_URL: z.string().url(),
  /** Feltöltött fájlok (aláírások, PDF-ek, csatolmányok) helye a lemezen. */
  STORAGE_DIR: z.string().default("./storage"),
  /** A lefordított webes felület mappája; ha üres, az API nem szolgál ki felületet. */
  WEB_DIST_DIR: z.string().optional(),
  /** A munkamenet élettartama órában (offline munkához ennyi ideig marad érvényes). */
  SESSION_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  /** Proxy (cPanel/LiteSpeed, Cloudflare) mögött a valódi kliens-IP miatt. */
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** Induláskor lefuttatja a hiányzó adatbázis-migrációkat (terminál nélküli telepítéshez). */
  AUTO_MIGRATE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  MIGRATIONS_DIR: z.string().optional(),
  SITE_NAME: z.string().default("MERT"),
  /** Csak az első induláshoz: ha még nincs felhasználó, ezzel jön létre az első admin. Utána törölhető. */
  INITIAL_ADMIN_USERNAME: z.string().trim().min(3).optional(),
  INITIAL_ADMIN_PASSWORD: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Hibás környezeti beállítás:\n${issues}`);
  }
  return parsed.data;
}
