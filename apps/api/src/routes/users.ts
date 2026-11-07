import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { userCreateSchema, userUpdateSchema, type UserListItem } from "@fbo/shared";
import { hashPassword } from "../auth/password.js";
import { HttpError } from "../errors.js";
import type { UserRecord } from "../store/types.js";

const toItem = (u: UserRecord): UserListItem => ({
  id: u.id,
  username: u.username,
  role: u.role,
  active: u.active,
  employeeId: u.employeeId,
});

/** Felhasználókezelés (csak admin). Jelszó soha nem kerül a válaszba és az audit naplóba. */
export async function userRoutes(app: FastifyInstance) {
  const { ctx } = app;

  async function assertEmployee(siteId: string, employeeId: string | null | undefined) {
    if (!employeeId) return;
    const emp = await ctx.store.masterData.findById("employee", employeeId);
    if (!emp || emp.siteId !== siteId) throw new HttpError(400, "A kiválasztott dolgozó nem található");
  }

  app.get("/", async (req) => {
    const admin = ctx.require(req, "users.manage");
    return (await ctx.store.users.list(admin.siteId)).map(toItem);
  });

  app.post("/", async (req, reply) => {
    const admin = ctx.require(req, "users.manage");
    const input = ctx.parse(userCreateSchema, req.body);
    if (await ctx.store.users.findByUsername(input.username)) {
      throw new HttpError(409, "Ez a felhasználónév már foglalt");
    }
    await assertEmployee(admin.siteId, input.employeeId);
    const user: UserRecord = {
      id: randomUUID(),
      siteId: admin.siteId,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      employeeId: input.employeeId,
      active: true,
    };
    await ctx.store.transaction(async (tx) => {
      await tx.users.create(user);
      await tx.audit.append({
        id: randomUUID(),
        at: ctx.now(),
        siteId: admin.siteId,
        userId: admin.id,
        entity: "user_account",
        entityId: user.id,
        action: "create",
        after: { username: user.username, role: user.role, employeeId: user.employeeId },
      });
    });
    return reply.status(201).send(toItem(user));
  });

  app.patch("/:id", async (req) => {
    const admin = ctx.require(req, "users.manage");
    const { id } = req.params as { id: string };
    const input = ctx.parse(userUpdateSchema, req.body);
    const before = await ctx.store.users.findById(id);
    if (!before || before.siteId !== admin.siteId) throw new HttpError(404, "Nem található");
    if (id === admin.id && (input.active === false || (input.role && input.role !== "admin"))) {
      throw new HttpError(400, "Saját magát nem tilthatja ki és nem veheti el a saját admin jogát");
    }
    await assertEmployee(admin.siteId, input.employeeId);

    const { password, ...rest } = input;
    const patch = { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) };
    await ctx.store.transaction(async (tx) => {
      await tx.users.update(id, patch);
      // Tiltás, jelszócsere vagy szerepkör-változás után a meglévő munkamenetek megszűnnek.
      if (input.active === false || password || input.role) await tx.sessions.deleteForUser(id);
      await tx.audit.append({
        id: randomUUID(),
        at: ctx.now(),
        siteId: admin.siteId,
        userId: admin.id,
        entity: "user_account",
        entityId: id,
        action: "update",
        before: { role: before.role, active: before.active, employeeId: before.employeeId },
        after: { ...rest, ...(password ? { password: "(megváltozott)" } : {}) },
      });
    });
    return toItem({ ...before, ...patch });
  });
}
