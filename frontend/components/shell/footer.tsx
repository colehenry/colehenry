"use client";

import { Mail } from "lucide-react";
import { usePathname } from "next/navigation";

import { GitHubIcon, LinkedInIcon } from "@/components/icons";

const links = [
  { href: "https://github.com/colehenry", label: "GitHub", icon: GitHubIcon },
  {
    href: "https://www.linkedin.com/in/cole-henry-9b699b178/",
    label: "LinkedIn",
    icon: LinkedInIcon,
  },
  { href: "mailto:crhenry81@gmail.com", label: "Email", icon: Mail },
];

export function Footer() {
  const pathname = usePathname();
  if (
    pathname === "/brain" ||
    pathname.startsWith("/brain/") ||
    pathname === "/coding" ||
    pathname.startsWith("/coding/")
  ) return null;

  return (
    <footer className="overscroll-cap-bottom relative z-10 border-t bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <p className="font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} cole henry
        </p>
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="rounded-md p-2 text-muted-foreground transition-colors duration-150 hover:text-brand"
            >
              <Icon className="size-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
