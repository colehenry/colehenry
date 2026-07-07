import { z } from "zod";

import { API_URL, ApiError, apiFetch } from "@/lib/api/client";

export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
});
export type User = z.infer<typeof userSchema>;

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
  await apiFetch("/auth/logout", z.object({ ok: z.boolean() }), {
    method: "POST",
  });
}

export const googleLoginUrl = `${API_URL}/auth/google/login`;
