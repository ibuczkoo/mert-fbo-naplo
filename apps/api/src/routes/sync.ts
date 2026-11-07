import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { syncRequestSchema, type SyncOpResult, type SyncResponse } from "@fbo/shared";
import { HttpError } from "../errors.js";
import { SYNC_HANDLERS, authorize } from "../sync/handlers.js";

/**
 * POST /api/sync – a készülék kimenő sorának feldolgozása, sorrendben.
 * Minden művelet saját tranzakcióban fut a nyugtájával együtt, így egy művelet
 * vagy teljesen rögzül (nyugtával), vagy egyáltalán nem. Ismételt beküldésnél
 * a tárolt nyugtát adjuk vissza ("duplicate"), újbóli végrehajtás nélkül.
 */
export async function syncRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post("/sync", async (req): Promise<SyncResponse> => {
    const user = ctx.requireUser(req);
    const { ops } = ctx.parse(syncRequestSchema, req.body);
    const results: SyncOpResult[] = [];

    for (const op of ops) {
      const seen = await ctx.store.syncOps.find(op.opId);
      if (seen) {
        if (seen.userId !== user.id) {
          results.push({ opId: op.opId, status: "rejected", error: "Érvénytelen műveletazonosító" });
        } else {
          results.push({ opId: op.opId, status: "duplicate", result: seen.result });
        }
        continue;
      }

      const handler = SYNC_HANDLERS[op.type];
      if (!handler) {
        results.push({ opId: op.opId, status: "rejected", error: `Ismeretlen művelet: ${op.type}` });
        continue;
      }

      try {
        authorize(handler, user);
        const result = await ctx.store.transaction(async (tx) => {
          const r = await handler.apply(tx, user, op.payload, { opId: op.opId, now: ctx.now() });
          await tx.syncOps.record({ id: op.opId, userId: user.id, receivedAt: ctx.now(), result: r ?? null });
          return r;
        });
        results.push({ opId: op.opId, status: "applied", result });
      } catch (err) {
        if (err instanceof HttpError && err.statusCode < 500) {
          results.push({ opId: op.opId, status: "rejected", error: err.message, details: err.details });
        } else if (err instanceof ZodError) {
          results.push({ opId: op.opId, status: "rejected", error: "Hibás adatok", details: err.issues });
        } else {
          // Szerverhiba: a sor itt megáll, a készülék később újrapróbálja a maradékot.
          req.log.error(err);
          break;
        }
      }
    }
    return { results };
  });
}
