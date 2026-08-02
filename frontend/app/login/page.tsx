import Link from "next/link";

import { googleLoginUrl } from "@/lib/api/auth";

export const metadata = { title: "Admin sign in" };

/**
 * Admin login. The API checks the returned Google email against its owner and
 * Cambio-host allowlists before it issues a session cookie.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-background px-4 text-foreground">
      <p className="text-center font-mono text-base">
        are you cole? if not, good luck
      </p>
      <div className="mt-7 flex flex-col items-center gap-4">
        <a
          href={googleLoginUrl}
          className="inline-flex items-center rounded-md border border-foreground bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          Sign in with Google
        </a>
        <Link
          href="/"
          className="font-mono text-xs underline underline-offset-4 hover:no-underline"
        >
          back to home
        </Link>
      </div>
    </main>
  );
}
