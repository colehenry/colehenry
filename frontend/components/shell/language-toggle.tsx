"use client";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale";

/**
 * Shows the language you'd switch TO (same semantics as the theme toggle's
 * sun/moon icon). No mounted guard needed: both server and first client
 * render are "en", so hydration always matches.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const next = locale === "en" ? "es" : "en";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        locale === "en" ? "Ver el sitio en español" : "View site in English"
      }
      onClick={() => setLocale(next)}
      className="font-mono text-xs"
    >
      {next.toUpperCase()}
    </Button>
  );
}
