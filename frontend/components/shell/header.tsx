"use client";

import { FileText, FolderGit2, Home, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { googleLoginUrl } from "@/lib/api/auth";
import { useLogout, useMe } from "@/lib/hooks/use-me";
import { sections } from "@/lib/sections";
import { cn } from "@/lib/utils";

function openPalette() {
  document.dispatchEvent(new CustomEvent("open-command-palette"));
}

export function Header() {
  const pathname = usePathname();
  const { me } = useMe();
  const logout = useLogout();

  const navSections = sections.filter(
    (s) =>
      (!s.ownerOnly || me) &&
      s.slug !== "blog" &&
      s.slug !== "journal" &&
      s.slug !== "dashboard",
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-baseline gap-1 font-mono text-sm"
        >
          <span className="text-carolina transition-colors duration-150">~/</span>
          <span className="font-medium tracking-tight">colehenry</span>
          <span className="animate-pulse text-carolina">▊</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navSections.map((s) => (
            <Link
              key={s.slug}
              href={s.path}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground",
                pathname.startsWith(s.path) && "text-foreground",
              )}
            >
              {s.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu data-icon="inline-start" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              aria-label="Mobile navigation"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link
                    href="/"
                    className={cn(pathname === "/" && "bg-accent text-accent-foreground")}
                  >
                    <Home />
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/#projects"
                    className={cn(
                      pathname === "/" && "bg-accent text-accent-foreground",
                    )}
                  >
                    <FolderGit2 />
                    Projects
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/#resume"
                    className={cn(
                      pathname === "/" && "bg-accent text-accent-foreground",
                    )}
                  >
                    <FileText />
                    Resume
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {navSections.map((s) => (
                  <DropdownMenuItem key={s.slug} asChild>
                    <Link
                      href={s.path}
                      className={cn(
                        pathname.startsWith(s.path) &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <span
                        data-section={s.accent}
                        className="size-2 rounded-full bg-brand"
                      />
                      {s.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={openPalette}>
                  <Search />
                  Search
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={openPalette}
            className="hidden items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors duration-150 hover:border-brand/40 hover:text-foreground sm:flex"
            aria-label="Open command palette"
          >
            <span>search</span>
            <kbd className="rounded-sm border bg-muted px-1 py-px text-[10px]">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
          {me ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground sm:flex"
                title={me.email}
              >
                <span className="size-1.5 rounded-full bg-brand-2" />
                owner
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                Log out
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <a href={googleLoginUrl}>Log in</a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
