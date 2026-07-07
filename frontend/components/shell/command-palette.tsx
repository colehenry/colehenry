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
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => run(() => router.push("/"))}>
              <Home />
              Home
              <CommandShortcut>/</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/#projects"))}>
              <FolderGit2 />
              Projects
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/#resume"))}>
              <FileText />
              Resume
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

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() =>
                run(() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark"),
                )
              }
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              Toggle theme
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => navigator.clipboard.writeText(EMAIL))
              }
            >
              <Copy />
              Copy email
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => window.open("https://github.com/colehenry", "_blank"))
              }
            >
              <GitHubIcon className="size-4" />
              Open GitHub
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Owner">
            {me ? (
              <>
                {/* TODO Build 2+: quick actions (log catan game, new post…) */}
                <CommandItem disabled>
                  <PenLine />
                  New post
                  <CommandShortcut>soon</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => run(() => logout.mutate())}>
                  <LogOut />
                  Log out
                </CommandItem>
              </>
            ) : (
              <CommandItem
                onSelect={() => run(() => (window.location.href = googleLoginUrl))}
              >
                <LogIn />
                Log in with Google
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
