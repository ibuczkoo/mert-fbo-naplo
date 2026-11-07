import type { FastifyInstance } from "fastify";
import { MASTER_DATA, MASTER_DATA_KINDS, can, type BootstrapPayload, type MasterDataKind } from "@fbo/shared";
import { HttpError } from "../errors.js";
import { createMasterData, updateMasterData } from "../masterdata.js";
import type { StoredMasterData } from "../store/types.js";

const strip = <T extends { siteId: string }>({ siteId: _s, ...rest }: T) => rest;

export async function masterDataRoutes(app: FastifyInstance) {
  const { ctx } = app;

  for (const kind of MASTER_DATA_KINDS) {
    const base = `/${MASTER_DATA[kind].path}`;

    // A listát minden szolgálatban lévő látja (névválasztók); az inaktívakat csak a kezelő.
    app.get(base, async (req) => {
      const user = ctx.require(req, "shift.view");
      const includeInactive = (req.query as { all?: string }).all === "1";
      if (includeInactive && !can(user.role, "masterData.manage")) {
        throw new HttpError(403, "Ehhez nincs jogosultsága");
      }
      const rows = await ctx.store.masterData.list(kind, user.siteId, { includeInactive });
      return rows.map(strip);
    });

    app.post(base, async (req, reply) => {
      const user = ctx.require(req, "masterData.manage");
      const rec = await ctx.store.transaction((tx) => createMasterData(tx, user, kind, req.body, ctx.now()));
      return reply.status(201).send(rec);
    });

    app.patch(`${base}/:id`, async (req) => {
      const user = ctx.require(req, "masterData.manage");
      const { id } = req.params as { id: string };
      return ctx.store.transaction((tx) => updateMasterData(tx, user, kind, id, req.body, ctx.now()));
    });
  }

  /** Offline működéshez: minden aktív törzsadat egy csomagban. */
  app.get("/bootstrap", async (req) => {
    const user = ctx.require(req, "shift.view");
    const site = await ctx.store.sites.findById(user.siteId);
    if (!site) throw new HttpError(404, "Az objektum nem található");
    const list = async <K extends MasterDataKind>(k: K) =>
      (await ctx.store.masterData.list(k, user.siteId)).map((r: StoredMasterData<K>) => strip(r));
    const payload: BootstrapPayload = {
      generatedAt: ctx.now().toISOString(),
      site: { id: site.id, name: site.name, timezone: site.timezone, settings: site.settings },
      employees: await list("employee"),
      equipment: await list("equipment"),
      weapons: await list("weapon"),
      gates: await list("gate"),
      incidentCategories: await list("incidentCategory"),
    };
    return payload;
  });
}

