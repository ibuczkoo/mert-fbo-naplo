import { sessionUserSchema, type LoginRequest, type SessionUser } from "@fbo/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "Nincs kapcsolat a szerverrel");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? "Ismeretlen hiba");
  return body as T;
}

export const api = {
  async me(): Promise<SessionUser | null> {
    try {
      return sessionUserSchema.parse(await request("/api/auth/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  async login(input: LoginRequest): Promise<SessionUser> {
    return sessionUserSchema.parse(await request("/api/auth/login", { method: "POST", body: JSON.stringify(input) }));
  },
  async logout(): Promise<void> {
    await request("/api/auth/logout", { method: "POST", body: "{}" });
  },
};
