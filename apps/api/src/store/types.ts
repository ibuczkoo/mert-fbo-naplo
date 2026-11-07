import type { MasterDataKind, MasterDataRecord, Role } from "@fbo/shared";

export interface UserRecord {
  id: string;
  siteId: string;
  username: string;
  passwordHash: string;
  role: Role;
  employeeId: string | null;
  active: boolean;
}

export interface SiteRecord {
  id: string;
  name: string;
  timezone: string;
  settings: unknown;
}

export type StoredMasterData<K extends MasterDataKind> = MasterDataRecord<K> & { siteId: string };

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  userAgent: string | null;
}

export interface AuditEntry {
  siteId: string;
  userId: string | null;
  entity: string;
  entityId: string;
  action: "create" | "update" | "delete" | "sign" | "login" | "logout";
  before?: unknown;
  after?: unknown;
}

export interface SyncOpRecord {
  id: string;
  userId: string;
  receivedAt: Date;
  result: unknown;
}

/**
 * Az adatelérés egyetlen felülete. Éles üzemben SQL (MariaDB / később PostgreSQL),
 * tesztekben memóriabeli megvalósítás – így az üzleti logika adatbázis nélkül is tesztelhető.
 */
export interface Store {
  sites: {
    findById(id: string): Promise<SiteRecord | null>;
  };
  users: {
    findByUsername(username: string): Promise<UserRecord | null>;
    findById(id: string): Promise<UserRecord | null>;
    create(user: UserRecord): Promise<void>;
    list(siteId: string): Promise<UserRecord[]>;
    update(id: string, patch: Partial<Pick<UserRecord, "role" | "active" | "passwordHash" | "employeeId">>): Promise<void>;
  };
  sessions: {
    create(s: SessionRecord): Promise<void>;
    find(tokenHash: string): Promise<SessionRecord | null>;
    extend(tokenHash: string, expiresAt: Date): Promise<void>;
    delete(tokenHash: string): Promise<void>;
    deleteForUser(userId: string): Promise<void>;
    deleteExpired(now: Date): Promise<number>;
  };
  masterData: {
    list<K extends MasterDataKind>(kind: K, siteId: string, opts?: { includeInactive?: boolean }): Promise<StoredMasterData<K>[]>;
    findById<K extends MasterDataKind>(kind: K, id: string): Promise<StoredMasterData<K> | null>;
    create<K extends MasterDataKind>(kind: K, rec: StoredMasterData<K>): Promise<void>;
    update<K extends MasterDataKind>(kind: K, id: string, patch: Partial<MasterDataRecord<K>>): Promise<void>;
  };
  audit: {
    append(entry: AuditEntry & { id: string; at: Date }): Promise<void>;
  };
  syncOps: {
    find(opId: string): Promise<SyncOpRecord | null>;
    record(op: SyncOpRecord): Promise<void>;
  };
  /** Több írás egy tranzakcióban (pl. rekord + audit + szinkron-nyugta). */
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
