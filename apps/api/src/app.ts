import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError, type ZodType } from "zod";
import { can, type Action, type SessionUser } from "@fbo/shared";
import { getDummyHash, verifyPassword } from "./auth/password.js";
import { createLoginLimiter, type LoginLimiter } from "./auth/rate-limit.js";
import { HttpError } from "./errors.js";
import { masterDataRoutes } from "./routes/masterdata.js";
import { syncRoutes } from "./routes/sync.js";
import { userRoutes } from "./routes/users.js";
import { authRoutes } from "./routes/auth.js";
import type { AuditEntry, Store, UserRecord } from "./store/types.js";

export const SESSION_COOKIE = "fbo_session";

export interface AppOptions {
  store: Store;
  sessionHours: number;
  secureCookies: boolean;
  trustProxy?: boolean;
  webDistDir?: string | undefined;
  logger?: boolean;
  now?: () => Date;
  limiter?: LoginLimiter;
}

declare module "fastify" {
  interface FastifyRequest {
    user: (SessionUser & { siteId: string }) | null;
  }
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export interface AppContext {
  store: Store;
  now: () => Date;
  limiter: LoginLimiter;
  sessionHours: number;
  secureCookies: boolean;
  /** Validál, és hiba esetén 400-as választ ad magyar üzenettel. */
  parse<T>(schema: ZodType<T>, data: unknown): T;
  requireUser(req: FastifyRequest): SessionUser & { siteId: string };
  require(req: FastifyRequest, action: Action): SessionUser & { siteId: string };
  audit(entry: AuditEntry): Promise<void>;
  newSession(reply: FastifyReply, user: UserRecord, userAgent: string | undefined): Promise<void>;
  verifyLogin(username: string, password: string): Promise<UserRecord | null>;
}

export { HttpError };

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function buildApp(opts: AppOptions) {
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: opts.trustProxy ?? true,
    bodyLimit: 2 * 1024 * 1024,
  });
  const now = opts.now ?? (() => new Date());
  const { store } = opts;

  await app.register(cookie);

  const ctx: AppContext = {
    store,
    now,
    limiter: opts.limiter ?? createLoginLimiter(),
    sessionHours: opts.sessionHours,
    secureCookies: opts.secureCookies,
    parse(schema, data) {
      try {
        return schema.parse(data);
      } catch (e) {
        if (e instanceof ZodError) {
          throw new HttpError(
            400,
            "Hibás adatok",
            e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          );
        }
        throw e;
      }
    },
    requireUser(req) {
      if (!req.user) throw new HttpError(401, "Bejelentkezés szükséges");
      return req.user;
    },
    require(req, action) {
      const user = ctx.requireUser(req);
      if (!can(user.role, action)) throw new HttpError(403, "Ehhez nincs jogosultsága");
      return user;
    },
    async audit(entry) {
      await store.audit.append({ ...entry, id: randomUUID(), at: now() });
    },
    async newSession(reply, user, userAgent) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now().getTime() + opts.sessionHours * 3600_000);
      await store.sessions.create({
        tokenHash: sha256(token),
        userId: user.id,
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      });
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: opts.secureCookies,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      });
    },
    async verifyLogin(username, password) {
      const user = await store.users.findByUsername(username);
      if (!user || !user.active) {
        await verifyPassword(password, await getDummyHash());
        return null;
      }
      return (await verifyPassword(password, user.passwordHash)) ? user : null;
    },
  };
  app.decorate("ctx", ctx);
  app.decorateRequest("user", null);

  // Munkamenet betöltése minden kéréshez; csúszó lejárat.
  app.addHook("onRequest", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const s = await store.sessions.find(sha256(token));
    if (!s || s.expiresAt <= now()) return;
    const u = await store.users.findById(s.userId);
    if (!u || !u.active) return;
    const emp = u.employeeId ? await store.masterData.findById("employee", u.employeeId) : null;
    req.user = {
      id: u.id,
      siteId: u.siteId,
      username: u.username,
      role: u.role,
      employee: emp ? { id: emp.id, fullName: emp.fullName, badgeNumber: emp.badgeNumber } : null,
    };
    const remaining = s.expiresAt.getTime() - now().getTime();
    if (remaining < (opts.sessionHours * 3600_000) / 2) {
      await store.sessions.extend(s.tokenHash, new Date(now().getTime() + opts.sessionHours * 3600_000));
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message, details: err.details });
    }
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.message });
    req.log.error(err);
    return reply.status(500).send({ error: "Váratlan szerverhiba" });
  });

  app.get("/api/health", async () => ({ status: "ok", time: now().toISOString() }));
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(masterDataRoutes, { prefix: "/api" });
  await app.register(syncRoutes, { prefix: "/api" });
  await app.register(userRoutes, { prefix: "/api/users" });

  // A lefordított PWA kiszolgálása ugyanabból a folyamatból (egy Node-alkalmazás a cPanelen).
  if (opts.webDistDir && existsSync(opts.webDistDir)) {
    const root = path.resolve(opts.webDistDir);
    await app.register(fastifyStatic, { root, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.status(404).send({ error: "Nem található" });
      return reply.sendFile("index.html", root);
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: "Nem található" }));
  }

  return app;
}
