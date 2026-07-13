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
    default: "colehenry.dev",
    template: "%s · colehenry.dev",
  },
  description:
    "Software engineer building agents, data tools, and personal systems.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
