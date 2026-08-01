import { API_URL, ApiError, apiFetch, type Parser } from "@/lib/api/client";

export type User = { id: number; email: string };

/**
 * Hand-written rather than a zod schema. The header and command palette call
 * `getMe` on every route, so a zod schema here put all of zod - its error
 * machinery and locale tables, ~70KB gzipped - into every page's initial
 * bundle to check two fields. Validation still happens; it just costs nothing.
 */
export const userSchema: Parser<User> = {
  parse(data: unknown): User {
    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as User).id !== "number" ||
      typeof (data as User).email !== "string"
    ) {
      throw new Error("Malformed /auth/me response");
    }
    const { id, email } = data as User;
    return { id, email };
  },
};

const okSchema: Parser<{ ok: boolean }> = {
  parse(data: unknown): { ok: boolean } {
    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as { ok: unknown }).ok !== "boolean"
    ) {
      throw new Error("Malformed /auth/logout response");
    }
    return { ok: (data as { ok: boolean }).ok };
  },
};

/** The logged-in owner, or null when the cookie is missing/invalid. */
export async function getMe(): Promise<User | null> {
  try {
    return await apiFetch("/auth/me", userSchema);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", okSchema, {
    method: "POST",
  });
}

export const googleLoginUrl = `${API_URL}/auth/google/login`;
