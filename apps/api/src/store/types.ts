import type { Role } from "@fbo/shared";

export interface UserRecord {
  id: string;
  siteId: string;
  username: string;
  passwordHash: string;
  role: Role;
  employeeId: string | null;
  active: boolean;
}

export interface EmployeeRecord {
  id: string;
  siteId: string;
  fullName: string;
  badgeNumber: string | null;
  active: boolean;
  createdAt: Date;
}

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

/**
 * Az adatelérés egyetlen felülete. Éles üzemben SQL (MariaDB / később PostgreSQL),
 * tesztekben memóriabeli megvalósítás – így az üzleti logika adatbázis nélkül is tesztelhető.
 */
export interface Store {
  users: {
    findByUsername(username: string): Promise<UserRecord | null>;
    findById(id: string): Promise<UserRecord | null>;
    create(user: UserRecord): Promise<void>;
  };
  sessions: {
    create(s: SessionRecord): Promise<void>;
    find(tokenHash: string): Promise<SessionRecord | null>;
    extend(tokenHash: string, expiresAt: Date): Promise<void>;
    delete(tokenHash: string): Promise<void>;
    deleteExpired(now: Date): Promise<number>;
  };
  employees: {
    list(siteId: string, opts?: { includeInactive?: boolean }): Promise<EmployeeRecord[]>;
    findById(id: string): Promise<EmployeeRecord | null>;
    findByBadge(siteId: string, badge: string): Promise<EmployeeRecord | null>;
    create(e: EmployeeRecord): Promise<void>;
  };
  audit: {
    append(entry: AuditEntry & { id: string; at: Date }): Promise<void>;
  };
  /** Több írás egy tranzakcióban (pl. rekord + audit). */
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
