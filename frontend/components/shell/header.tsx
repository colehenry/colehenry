"use client";

import {
  ChevronDown,
  FileText,
  FolderGit2,
  Home,
  LogIn,
  LogOut,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LanguageToggle } from "@/components/shell/language-toggle";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { googleLoginUrl } from "@/lib/api/auth";
import { useCambioHost, useLogout, useMe } from "@/lib/hooks/use-me";
import { useLocale } from "@/lib/i18n/locale";
import { ui } from "@/lib/i18n/ui";
import { sections } from "@/lib/sections";
import { cn } from "@/lib/utils";

function openPalette() {
  document.dispatchEvent(new CustomEvent("open-command-palette"));
}

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [navOpen, setNavOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = useRef(false);
  const { me, isLoading: isLoadingMe } = useMe();
  const { cambioHost } = useCambioHost();
  const logout = useLogout();
  const { locale } = useLocale();
  const nav = ui[locale].nav;
  const palette = ui[locale].palette;

  const navSections = sections.filter(
    (s) =>
      (!s.ownerOnly || me) &&
      (!s.cambioHostOnly || cambioHost) &&
      s.slug !== "blog" &&
      s.slug !== "journal" &&
      s.slug !== "dashboard",
  );

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openOnHover = (pointerType: string) => {
    if (pointerType !== "mouse") return;
    cancelClose();
    openedByHover.current = true;
    setNavOpen(true);
  };

  const closeAfterHover = (pointerType: string) => {
    if (pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setNavOpen(false);
    }, 120);
  };

  const handleOpenChange = (open: boolean) => {
    cancelClose();
    if (open) openedByHover.current = false;
    setNavOpen(open);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <header className="overscroll-cap-top sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <DropdownMenu
          open={navOpen}
          onOpenChange={handleOpenChange}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-1 rounded-md py-1 pr-1 font-mono text-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:text-foreground"
              aria-label="Open navigation menu"
              onPointerEnter={(event) => openOnHover(event.pointerType)}
              onPointerLeave={(event) => closeAfterHover(event.pointerType)}
            >
              <span className="flex items-baseline gap-1">
                <span className="text-brand transition-colors duration-150">
                  ~/
                </span>
                <span className="font-medium tracking-tight">colehenry</span>
                <span className="animate-pulse text-brand">▊</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-1 font-mono shadow-lg"
            aria-label="Site navigation"
            onPointerEnter={(event) => openOnHover(event.pointerType)}
            onPointerLeave={(event) => closeAfterHover(event.pointerType)}
            onCloseAutoFocus={(event) => {
              if (openedByHover.current) event.preventDefault();
              openedByHover.current = false;
            }}
          >
            <DropdownMenuLabel className="px-2 py-1.5">
              {palette.navigate}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  href="/"
                  className={cn(
                    "rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast",
                    pathname === "/" &&
                      "bg-brand text-brand-contrast **:text-brand-contrast",
                  )}
                >
                  <Home />
                  {nav.home}
                  <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                    /
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/#projects"
                  className="rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast"
                >
                  <FolderGit2 />
                  {nav.projects}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/#resume"
                  className="rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast"
                >
                  <FileText />
                  {nav.resume}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {navSections.map((section) => {
                const active =
                  pathname === section.path ||
                  pathname.startsWith(`${section.path}/`);

                return (
                  <DropdownMenuItem key={section.slug} asChild>
                    <Link
                      href={section.path}
                      className={cn(
                        "rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast",
                        active &&
                          "bg-brand text-brand-contrast **:text-brand-contrast",
                      )}
                    >
                      <span
                        data-section={section.accent}
                        className="size-2 rounded-full bg-brand"
                      />
                      <span className="min-w-0 truncate">{section.name}</span>
                      <span className="ml-auto shrink-0 text-xs tracking-widest text-muted-foreground">
                        {section.path}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={openPalette}
              className="rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast"
            >
              <Search />
              {nav.search}
              <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                ⌘K
              </span>
            </DropdownMenuItem>
            {me ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast"
                >
                  <LogOut />
                  {nav.logout}
                </DropdownMenuItem>
              </>
            ) : !isLoadingMe ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href={googleLoginUrl}
                    className="rounded-lg px-2 py-1.5 focus:bg-brand focus:text-brand-contrast focus:**:text-brand-contrast"
                  >
                    <LogIn />
                    Sign In (Admin)
                  </a>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={openPalette}
            className={cn(
              "items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors duration-150 hover:border-brand/40 hover:text-foreground",
              isHome ? "hidden" : "hidden sm:flex",
            )}
            aria-label="Open command palette"
          >
            <span>{nav.searchButton}</span>
            <kbd className="rounded-sm border bg-muted px-1 py-px text-[10px]">
              ⌘K
            </kbd>
          </button>
          {!pathname.startsWith("/cambio") ? <LanguageToggle /> : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
