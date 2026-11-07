import type { SyncOpResult, SyncResponse } from "@fbo/shared";
import { localDb, type LocalDb, type OutboxItem } from "./db";

export type FlushOutcome =
  | { kind: "idle" }
  | { kind: "done"; applied: number; rejected: number }
  | { kind: "offline" }
  | { kind: "unauthorized" }
  | { kind: "serverError" };

type Fetch = typeof fetch;

/**
 * Szinkronmotor: a kimenő sort sorrendben felküldi.
 *  - applied / duplicate → törlődik a sorból (a szerver rögzítette)
 *  - rejected / conflict → a sorban marad megjelölve, a felhasználónak döntenie kell;
 *    nem próbálja újra vakon, de nem is állítja meg a többi műveletet
 *  - hálózati vagy szerverhiba → megáll, később újrapróbálja (a sorrend megmarad)
 */
export class SyncEngine {
  private running: Promise<FlushOutcome> | null = null;
  private seq = Date.now();

  constructor(
    private db: LocalDb = localDb,
    private doFetch: Fetch = (...a) => fetch(...a),
    private batchSize = 50,
  ) {}

  async enqueue(type: string, payload: unknown, opId: string = crypto.randomUUID()): Promise<string> {
    const item: OutboxItem = {
      opId,
      type,
      payload,
      createdAt: new Date().toISOString(),
      seq: ++this.seq,
      status: "pending",
      attempts: 0,
    };
    await this.db.outbox.add(item);
    return opId;
  }

  pendingCount(): Promise<number> {
    return this.db.outbox.where("status").equals("pending").count();
  }

  /** Egyszerre csak egy feltöltés fut; párhuzamos hívás ugyanazt az eredményt kapja. */
  flush(): Promise<FlushOutcome> {
    this.running ??= this.doFlush().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async doFlush(): Promise<FlushOutcome> {
    let applied = 0;
    let rejected = 0;
    for (;;) {
      const batch = await this.db.outbox.orderBy("seq").filter((i) => i.status === "pending").limit(this.batchSize).toArray();
      if (batch.length === 0) return applied + rejected === 0 ? { kind: "idle" } : { kind: "done", applied, rejected };

      let res: Response;
      try {
        res = await this.doFetch("/api/sync", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ops: batch.map(({ opId, type, createdAt, payload }) => ({ opId, type, createdAt, payload })),
          }),
        });
      } catch {
        await this.bumpAttempts(batch);
        return { kind: "offline" };
      }
      if (res.status === 401) return { kind: "unauthorized" };
      if (!res.ok) {
        await this.bumpAttempts(batch);
        return { kind: "serverError" };
      }

      const { results } = (await res.json()) as SyncResponse;
      await this.db.transaction("rw", this.db.outbox, async () => {
        for (const r of results) {
          if (r.status === "applied" || r.status === "duplicate") {
            await this.db.outbox.delete(r.opId);
            applied++;
          } else {
            await this.db.outbox.update(r.opId, { status: r.status, error: describe(r) });
            rejected++;
          }
        }
      });
      // Ha a szerver menet közben megállt (szerverhiba egy műveletnél), a maradékot később küldjük.
      if (results.length < batch.length) return { kind: "serverError" };
    }
  }

  private async bumpAttempts(batch: OutboxItem[]) {
    await this.db.outbox.bulkUpdate(batch.map((i) => ({ key: i.opId, changes: { attempts: i.attempts + 1 } })));
  }

  /** Elutasított művelet eldobása a felhasználó döntése után. */
  discard(opId: string): Promise<void> {
    return this.db.outbox.delete(opId);
  }
}

function describe(r: SyncOpResult): string {
  return "error" in r ? r.error : "Ismeretlen hiba";
}

export const syncEngine = new SyncEngine();

/** Automatikus szinkron: induláskor, hálózat visszatérésekor és félpercenként. */
export function startAutoSync(engine: SyncEngine = syncEngine, intervalMs = 30_000): () => void {
  const run = () => {
    if (navigator.onLine) void engine.flush();
  };
  window.addEventListener("online", run);
  const t = window.setInterval(run, intervalMs);
  run();
  return () => {
    window.removeEventListener("online", run);
    window.clearInterval(t);
  };
}
