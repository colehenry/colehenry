import Link from "next/link";

import { googleLoginUrl } from "@/lib/api/auth";

export const metadata = { title: "Log in" };

/**
 * Owner login. One button; the API runs the whole OAuth flow and redirects
 * back with the session cookie set.
 */
export default function LoginPage() {
  return (
    <div className="relative">
      <div className="bg-grid absolute inset-x-0 top-0 h-72" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-32 pb-40 sm:px-6">
        <p className="section-label reveal">/login</p>
        <h1 className="reveal mt-4 font-heading text-4xl font-medium tracking-tight" style={{ "--reveal-i": 1 } as React.CSSProperties}>
          Owner access
        </h1>
        <p
          className="reveal mt-3 max-w-sm text-center text-muted-foreground"
          style={{ "--reveal-i": 2 } as React.CSSProperties}
        >
          One account gets in. If that&apos;s not you, the front door is{" "}
          <Link
            href="/"
            className="text-brand underline-offset-4 hover:underline"
          >
            back this way
          </Link>
          .
        </p>
        <a
          href={googleLoginUrl}
          className="reveal mt-8 inline-flex items-center gap-3 rounded-lg border bg-card px-6 py-3 text-sm font-medium shadow-sm transition-colors duration-150 hover:border-brand/50"
          style={{ "--reveal-i": 3 } as React.CSSProperties}
        >
          {/* Google "G" */}
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.03c2.2-2.1 3.5-5.1 3.5-8.6"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-5l-.14.01-3.6 2.8-.05.13C3.4 21.3 7.4 24 12 24"
            />
            <path
              fill="#FBBC05"
              d="M5.2 14.4c-.3-.7-.4-1.5-.4-2.4s.2-1.6.4-2.4l-.01-.16-3.7-2.8-.12.06C.5 8.2 0 10 0 12s.5 3.8 1.4 5.3l3.8-2.9"
            />
            <path
              fill="#EB4335"
              d="M12 4.6c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.7l3.8 2.9c1-2.9 3.6-5 6.8-5"
            />
          </svg>
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
