import { z } from "zod";
import { MASTER_DATA_KINDS, can, type Action, type MasterDataKind, type Role } from "@fbo/shared";
import { HttpError } from "../errors.js";
import { createMasterData, updateMasterData } from "../masterdata.js";
import type { Store } from "../store/types.js";

export interface SyncActor {
  id: string;
  siteId: string;
  role: Role;
}

export interface SyncHandler {
  requires: Action;
  apply(tx: Store, actor: SyncActor, payload: unknown, ctx: { opId: string; now: Date }): Promise<unknown>;
}

const kindSchema = z.enum(MASTER_DATA_KINDS as [MasterDataKind, ...MasterDataKind[]]);

/**
 * A szinkronnal érkező művelettípusok. Minden modul ide regisztrálja a sajátjait
 * (pl. "shift.save", "shift.sign" az 1. fázisban). Ugyanazt az üzleti logikát hívják,
 * mint a közvetlen API-végpontok, így online és offline rögzítés pontosan ugyanúgy viselkedik.
 */
export const SYNC_HANDLERS: Record<string, SyncHandler> = {
  "masterData.create": {
    requires: "masterData.manage",
    async apply(tx, actor, payload, { opId, now }) {
      const p = z.object({ kind: kindSchema, data: z.unknown() }).parse(payload);
      // A művelet azonosítója lesz a rekord azonosítója: a készülék már offline ismeri.
      return createMasterData(tx, actor, p.kind, p.data, now, opId);
    },
  },
  "masterData.update": {
    requires: "masterData.manage",
    async apply(tx, actor, payload, { now }) {
      const p = z.object({ kind: kindSchema, id: z.string().uuid(), data: z.unknown() }).parse(payload);
      return updateMasterData(tx, actor, p.kind, p.id, p.data, now);
    },
  },
};

export function authorize(handler: SyncHandler, actor: SyncActor) {
  if (!can(actor.role, handler.requires)) throw new HttpError(403, "Ehhez nincs jogosultsága");
}
