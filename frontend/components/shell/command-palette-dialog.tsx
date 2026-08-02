"use client";

import {
  Copy,
  FileText,
  FolderGit2,
  Home,
  LogOut,
  Moon,
  PenLine,
  Sun,
} from "lucide-react";

import { GitHubIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback } from "react";

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
import { useLogout, useMe } from "@/lib/hooks/use-me";
import { useLocale } from "@/lib/i18n/locale";
import { ui } from "@/lib/i18n/ui";
import { sections } from "@/lib/sections";

const EMAIL = "crhenry81@gmail.com";

/**
 * The palette's contents - everything that needs `cmdk`. Split out of
 * `command-palette.tsx` so this chunk (~33KB gzipped) loads on first open
 * rather than on every page, since the palette is closed until ⌘K.
 * The open state and its key handler live in the parent.
 */
export function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { me } = useMe();
  const logout = useLogout();
  const { locale } = useLocale();
  const p = ui[locale].palette;
  const nav = ui[locale].nav;

  const run = useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
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

          {me && (
            <>
              <CommandSeparator />
              <CommandGroup heading={p.owner}>
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
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
