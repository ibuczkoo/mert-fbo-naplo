import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { employeeInputSchema } from "@fbo/shared";
import { HttpError } from "../app.js";

export async function employeeRoutes(app: FastifyInstance) {
  const { ctx } = app;

  // A dolgozólista minden szolgálatban lévőnek kell (névválasztók, offline törzsadat).
  app.get("/", async (req) => {
    const user = ctx.require(req, "shift.view");
    const list = await ctx.store.employees.list(user.siteId);
    return list.map(({ id, fullName, badgeNumber, active }) => ({ id, fullName, badgeNumber, active }));
  });

  app.post("/", async (req, reply) => {
    const user = ctx.require(req, "masterData.manage");
    const input = ctx.parse(employeeInputSchema, req.body);
    if (input.badgeNumber && (await ctx.store.employees.findByBadge(user.siteId, input.badgeNumber))) {
      throw new HttpError(409, "Ezzel a jelvényszámmal már van dolgozó");
    }
    const record = { id: randomUUID(), siteId: user.siteId, ...input, createdAt: ctx.now() };
    await ctx.store.transaction(async (tx) => {
      await tx.employees.create(record);
      await tx.audit.append({
        id: randomUUID(),
        at: ctx.now(),
        siteId: user.siteId,
        userId: user.id,
        entity: "employee",
        entityId: record.id,
        action: "create",
        after: input,
      });
    });
    return reply.status(201).send({
      id: record.id,
      fullName: record.fullName,
      badgeNumber: record.badgeNumber,
      active: record.active,
    });
  });
}
