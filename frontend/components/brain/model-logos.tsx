import type { ModelProvider } from "@/lib/api/brain";

/** Small, self-contained provider marks (brand colors) for the model picker. */
export function ProviderLogo({
  provider,
  className = "size-4",
}: {
  provider: ModelProvider;
  className?: string;
}) {
  switch (provider) {
    case "anthropic":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <g stroke="#CC785C" strokeWidth="2.3" strokeLinecap="round">
            <path d="M12 3.5v17M4.9 6.6l14.2 10.8M4.9 17.4 19.1 6.6" />
          </g>
        </svg>
      );
    case "openai":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            d="M12 3.4 18.7 7.2v9.6L12 20.6 5.3 16.8V7.2z"
          />
          <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="#4285F4" d="M21.3 12.2c0-.66-.06-1.3-.17-1.9H12v3.6h5.2a4.5 4.5 0 0 1-1.9 2.95v2.45h3.07c1.8-1.66 2.83-4.1 2.83-7.1z" />
          <path fill="#34A853" d="M12 21.5c2.56 0 4.7-.85 6.27-2.3l-3.07-2.38c-.85.57-1.94.9-3.2.9-2.46 0-4.55-1.66-5.3-3.9H3.53v2.45A9.5 9.5 0 0 0 12 21.5z" />
          <path fill="#FBBC05" d="M6.7 13.82a5.7 5.7 0 0 1 0-3.64V7.73H3.53a9.5 9.5 0 0 0 0 8.54z" />
          <path fill="#EA4335" d="M12 6.28c1.4 0 2.65.48 3.63 1.42l2.72-2.72C16.7 3.46 14.56 2.5 12 2.5A9.5 9.5 0 0 0 3.53 7.73L6.7 10.18c.75-2.24 2.84-3.9 5.3-3.9z" />
        </svg>
      );
    case "deepseek":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path
            fill="#4D6BFE"
            d="M3.6 12.6c4.6.5 6.2-4.2 11.2-3.6 2.1.25 4.1 1.3 5.2 2.7-.85 3.8-4.4 6.3-8.7 6.3-4.3 0-7.2-2.1-7.7-5.4z"
          />
          <circle cx="9.2" cy="12.3" r="1" fill="#fff" />
        </svg>
      );
    case "mistral":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="3" y="4.4" width="18" height="3.3" fill="#FFD800" />
          <rect x="3" y="8.35" width="18" height="3.3" fill="#FFAF00" />
          <rect x="3" y="12.3" width="18" height="3.3" fill="#FF8205" />
          <rect x="3" y="16.25" width="18" height="3.3" fill="#FA500F" />
        </svg>
      );
    case "meta":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="none" stroke="#4B7BEC" strokeWidth="2.1" strokeLinecap="round" d="M3.4 15.7c2.7-6.8 4.7-9.4 6.1-9.4 2.2 0 2.3 8.2 4.7 8.2 1.3 0 2.8-2.4 6.4-7.4M3.4 15.7c2.1 2.4 4 3.4 5.7 2.8 1.9-.7 3-3.3 5.1-3.3 2 0 3.7 1.1 6.4 3.2" />
        </svg>
      );
    case "qwen":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="#6E4DF5" d="M12 3.2a8.8 8.8 0 1 0 5.9 15.3l2.1 2.1 1.5-1.5-2.1-2.1A8.8 8.8 0 0 0 12 3.2Zm0 2.4a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8Z" />
          <path fill="#6E4DF5" d="M9.1 9.2h2.2l1.1 2.2 1.1-2.2h2.2l-2.2 4.1 2.1 3.5h-2.2l-1-1.9-1 1.9H9.2l2.1-3.5z" />
        </svg>
      );
  }
}
