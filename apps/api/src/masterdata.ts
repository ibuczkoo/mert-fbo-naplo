import { randomUUID } from "node:crypto";
import {
  MASTER_DATA,
  type MasterDataInput,
  type MasterDataKind,
  type MasterDataRecord,
} from "@fbo/shared";
import { HttpError } from "./errors.js";
import type { Store, StoredMasterData } from "./store/types.js";


const collator = new Intl.Collator("hu");

export function displayName(kind: MasterDataKind, r: Record<string, unknown>): string {
  switch (kind) {
    case "employee":
      return String(r.fullName);
    case "equipment":
      return `${r.kind} ${r.serial}`;
    case "weapon":
      return `${r.model} ${r.serial}`;
    default:
      return String(r.name);
  }
}

export function sortMasterData<K extends MasterDataKind>(kind: K, rows: StoredMasterData<K>[]): StoredMasterData<K>[] {
  return rows.sort((a, b) => collator.compare(displayName(kind, a), displayName(kind, b)));
}

/** Melyik mezőkombináció egyedi entitásonként (null érték nem ütközik). */
function uniqueKey(kind: MasterDataKind, r: Record<string, unknown>): string | null {
  const norm = (v: unknown) => String(v).trim().toLowerCase();
  switch (kind) {
    case "employee":
      return r.badgeNumber ? norm(r.badgeNumber) : null;
    case "equipment":
      return `${r.kind}|${norm(r.serial)}`;
    case "weapon":
      return norm(r.serial);
    default:
      return norm(r.name);
  }
}

const DUPLICATE_MESSAGES: Record<MasterDataKind, string> = {
  employee: "Ezzel a jelvényszámmal már van dolgozó",
  equipment: "Ilyen típusú eszköz ezzel a számmal már szerepel",
  weapon: "Ezzel a sorozatszámmal már van fegyver",
  gate: "Ilyen nevű kapu már van",
  incidentCategory: "Ilyen nevű kategória már van",
};

async function assertUnique(store: Store, kind: MasterDataKind, siteId: string, rec: Record<string, unknown>, selfId?: string) {
  const key = uniqueKey(kind, rec);
  if (key === null) return;
  const all = await store.masterData.list(kind, siteId, { includeInactive: true });
  if (all.some((x) => x.id !== selfId && uniqueKey(kind, x) === key)) {
    throw new HttpError(409, DUPLICATE_MESSAGES[kind]);
  }
}

export interface Actor {
  id: string;
  siteId: string;
}

export function parseInput<K extends MasterDataKind>(kind: K, data: unknown, partial = false): MasterDataInput<K> {
  const schema = MASTER_DATA[kind].schema;
  const parsed = (partial ? schema.partial() : schema).safeParse(data);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "Hibás adatok",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  if (!partial) return parsed.data as MasterDataInput<K>;
  // Részleges módosításnál csak a ténylegesen beküldött mezők számítanak:
  // az alapértékek (pl. active: true) nem írhatnak felül meglévő adatot.
  const sent = data && typeof data === "object" ? Object.keys(data) : [];
  return Object.fromEntries(
    Object.entries(parsed.data as Record<string, unknown>).filter(([k]) => sent.includes(k)),
  ) as MasterDataInput<K>;
}

export async function createMasterData<K extends MasterDataKind>(
  store: Store,
  actor: Actor,
  kind: K,
  data: unknown,
  now: Date,
  id: string = randomUUID(),
): Promise<MasterDataRecord<K>> {
  const input = parseInput(kind, data);
  await assertUnique(store, kind, actor.siteId, input);
  const rec = { ...input, id, siteId: actor.siteId } as StoredMasterData<K>;
  await store.masterData.create(kind, rec);
  await store.audit.append({
    id: randomUUID(),
    at: now,
    siteId: actor.siteId,
    userId: actor.id,
    entity: kind,
    entityId: id,
    action: "create",
    after: input,
  });
  const { siteId: _s, ...pub } = rec;
  return pub as MasterDataRecord<K>;
}

export async function updateMasterData<K extends MasterDataKind>(
  store: Store,
  actor: Actor,
  kind: K,
  id: string,
  data: unknown,
  now: Date,
): Promise<MasterDataRecord<K>> {
  const before = await store.masterData.findById(kind, id);
  if (!before || before.siteId !== actor.siteId) throw new HttpError(404, "Nem található");
  const patch = parseInput(kind, data, true) as Partial<MasterDataRecord<K>>;
  const merged = { ...before, ...patch };
  await assertUnique(store, kind, actor.siteId, merged, id);
  await store.masterData.update(kind, id, patch);
  const { siteId: _b, ...beforePub } = before;
  await store.audit.append({
    id: randomUUID(),
    at: now,
    siteId: actor.siteId,
    userId: actor.id,
    entity: kind,
    entityId: id,
    action: "update",
    before: beforePub,
    after: patch,
  });
  const { siteId: _m, ...pub } = merged;
  return pub as MasterDataRecord<K>;
}
