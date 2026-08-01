import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { HeroConstellation } from "@/components/portfolio/hero-constellation";
import { CommandPalette } from "@/components/shell/command-palette";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://colehenry.dev"),
  title: {
    default: "Cole Henry | AI SWE",
    template: "%s · colehenry.dev",
  },
  description:
    "AI software engineer building production AI agents, RAG systems, and data tools with Python, TypeScript, and React.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Cole Henry",
    title: "Cole Henry | AI SWE",
    description:
      "Production AI agents, RAG systems, and data tools built with Python, TypeScript, and React.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Cole Henry | AI SWE",
    description:
      "Production AI agents, RAG systems, and data tools built with Python, TypeScript, and React.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} bg-background noise flex min-h-svh flex-col antialiased`}
      >
        <Providers>
          <div className="relative isolate flex min-h-svh flex-col">
            <Header />
            <HeroConstellation />
            <main className="relative z-10 min-h-0 flex-1">{children}</main>
            <Footer />
            <CommandPalette />
          </div>
        </Providers>
      </body>
    </html>
  );
}
