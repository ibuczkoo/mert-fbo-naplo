import type { FastifyInstance } from "fastify";
import { loginRequestSchema } from "@fbo/shared";
import { HttpError, SESSION_COOKIE, sha256 } from "../app.js";

export async function authRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post("/login", async (req, reply) => {
    const body = ctx.parse(loginRequestSchema, req.body);
    if (ctx.limiter.isBlocked(body.username, req.ip)) {
      throw new HttpError(429, "Túl sok sikertelen próbálkozás. Próbálja újra 15 perc múlva.");
    }
    const user = await ctx.verifyLogin(body.username, body.password);
    if (!user) {
      ctx.limiter.fail(body.username, req.ip);
      throw new HttpError(401, "Hibás felhasználónév vagy jelszó");
    }
    ctx.limiter.reset(body.username, req.ip);
    await ctx.newSession(reply, user, req.headers["user-agent"]);
    await ctx.audit({
      siteId: user.siteId,
      userId: user.id,
      entity: "user_account",
      entityId: user.id,
      action: "login",
      after: { ip: req.ip },
    });
    const emp = user.employeeId ? await ctx.store.employees.findById(user.employeeId) : null;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      employee: emp ? { id: emp.id, fullName: emp.fullName, badgeNumber: emp.badgeNumber } : null,
    };
  });

  app.post("/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await ctx.store.sessions.delete(sha256(token));
    if (req.user) {
      await ctx.audit({
        siteId: req.user.siteId,
        userId: req.user.id,
        entity: "user_account",
        entityId: req.user.id,
        action: "logout",
      });
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (req) => {
    const { siteId: _siteId, ...user } = ctx.requireUser(req);
    return user;
  });
}
