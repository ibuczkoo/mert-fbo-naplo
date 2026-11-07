/**
 * Egyszerű bejelentkezési korlát: azonos felhasználónév + IP párosra
 * 15 percen belül legfeljebb 5 sikertelen próbálkozás.
 * Memóriában tartjuk: egy folyamatban fut az alkalmazás, újraindításkor nullázódik.
 */
export function createLoginLimiter(opts = { max: 5, windowMs: 15 * 60 * 1000 }) {
  const failures = new Map<string, number[]>();

  const key = (username: string, ip: string) => `${username.toLowerCase()}|${ip}`;
  const recent = (k: string, now: number) => (failures.get(k) ?? []).filter((t) => now - t < opts.windowMs);

  return {
    isBlocked(username: string, ip: string, now = Date.now()): boolean {
      return recent(key(username, ip), now).length >= opts.max;
    },
    fail(username: string, ip: string, now = Date.now()): void {
      const k = key(username, ip);
      failures.set(k, [...recent(k, now), now]);
    },
    reset(username: string, ip: string): void {
      failures.delete(key(username, ip));
    },
  };
}
export type LoginLimiter = ReturnType<typeof createLoginLimiter>;
