"use client";

import {
  Copy,
  FileText,
  FolderGit2,
  Home,
  LogIn,
  LogOut,
  Moon,
  PenLine,
  Sun,
} from "lucide-react";

import { GitHubIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Command } from "@/components/ui/command";
import { googleLoginUrl } from "@/lib/api/auth";
import { useLogout, useMe } from "@/lib/hooks/use-me";
import { useLocale } from "@/lib/i18n/locale";
import { ui } from "@/lib/i18n/ui";
import { sections } from "@/lib/sections";

const EMAIL = "crhenry81@gmail.com";

/**
 * The site-wide ⌘K palette — mounted once in the root layout.
 * Also opens via the header button (a custom "open-command-palette" event).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { me } = useMe();
  const logout = useLogout();
  const { locale } = useLocale();
  const p = ui[locale].palette;
  const nav = ui[locale].nav;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command className="font-mono">
        <CommandInput placeholder={p.placeholder} />
        <CommandList>
          <CommandEmpty>{p.noResults}</CommandEmpty>

          <CommandGroup heading={p.navigate}>
            <CommandItem onSelect={() => run(() => router.push("/"))}>
              <Home />
              {nav.home}
              <CommandShortcut>/</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/#projects"))}>
              <FolderGit2 />
              {nav.projects}
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/#resume"))}>
              <FileText />
              {nav.resume}
            </CommandItem>
            {sections
              .filter((s) => !s.ownerOnly || me)
              .map((s) => (
                <CommandItem
                  key={s.slug}
                  onSelect={() => run(() => router.push(s.path))}
                >
                  <span
                    data-section={s.accent}
                    className="size-2 rounded-full bg-brand"
                  />
                  {s.name}
                  <CommandShortcut>{s.path}</CommandShortcut>
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={p.actions}>
            <CommandItem
              onSelect={() =>
                run(() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark"),
                )
              }
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              {p.toggleTheme}
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => navigator.clipboard.writeText(EMAIL))
              }
            >
              <Copy />
              {p.copyEmail}
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => window.open("https://github.com/colehenry", "_blank"))
              }
            >
              <GitHubIcon className="size-4" />
              {p.openGithub}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={p.owner}>
            {me ? (
              <>
                {/* TODO Build 2+: quick actions (log catan game, new post…) */}
                <CommandItem disabled>
                  <PenLine />
                  {p.newPost}
                  <CommandShortcut>{p.soon}</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => run(() => logout.mutate())}>
                  <LogOut />
                  {p.logout}
                </CommandItem>
              </>
            ) : (
              <CommandItem
                onSelect={() => run(() => (window.location.href = googleLoginUrl))}
              >
                <LogIn />
                {p.loginGoogle}
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
