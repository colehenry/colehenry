"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Locale = "en" | "es";

/**
 * A value with one variant per site language - `t()` from useLocale picks the
 * active one. Typing content as Localized<T> makes a missing translation a
 * compile error, which is the whole maintainability story: add text in one
 * language and the build breaks until the other exists.
 */
export type Localized<T> = { en: T; es: T };

const STORAGE_KEY = "locale";

// localStorage as an external store: SSR snapshots "en", the stored
// preference applies right after hydration (same brief-flash tradeoff
// next-themes makes for us).
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Locale {
  return window.localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
}

function getServerSnapshot(): Locale {
  return "en";
}

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LanguageProvider");
  const { locale, setLocale } = ctx;
  const t = useCallback(
    function t<T>(value: Localized<T>): T {
      return value[locale];
    },
    [locale],
  );
  return { locale, setLocale, t };
}

const MONTHS_ES: Record<string, string> = {
  Jan: "ene",
  Feb: "feb",
  Mar: "mar",
  Apr: "abr",
  May: "may",
  Jun: "jun",
  Jul: "jul",
  Aug: "ago",
  Sep: "sep",
  Oct: "oct",
  Nov: "nov",
  Dec: "dic",
};

/** Localizes resume date strings like "Sep 2025" / "present". */
export function localizeDate(date: string, locale: Locale): string {
  if (locale === "en") return date;
  if (date === "present") return "actual";
  const [month, year] = date.split(" ");
  const es = MONTHS_ES[month];
  return es && year ? `${es} ${year}` : date;
}
