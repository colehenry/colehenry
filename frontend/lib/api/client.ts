export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Anything that validates an unknown response into a `T`. Structural rather
 * than `z.ZodType` on purpose: zod schemas satisfy it, but so does a plain
 * hand-written guard, which keeps modules that only check a trivial shape from
 * dragging all of zod into a bundle. See `lib/api/auth`, which the site header
 * imports on every route.
 */
export type Parser<T> = { parse(data: unknown): T };

/**
 * Fetch from the API with credentials, then validate the response.
 * All API access goes through this so every response is typed at runtime.
 */
export async function apiFetch<T>(
  path: string,
  schema: Parser<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  return schema.parse(await res.json());
}
