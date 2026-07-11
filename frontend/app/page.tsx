"use client";

import { ArrowUpRight, FileText, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AppLogoIcon, GitHubIcon, LinkedInIcon } from "@/components/icons";
import { QuenoseteolvideShowcase } from "@/components/language/quenoseteolvide-showcase";
import { ResumeSection } from "@/components/portfolio/resume-section";
import { resume } from "@/lib/resume";
import { cn } from "@/lib/utils";

const heroLinks = [
  { href: resume.github, label: "GitHub", icon: GitHubIcon },
  { href: resume.linkedin, label: "LinkedIn", icon: LinkedInIcon },
  { href: `mailto:${resume.email}`, label: "Email", icon: Mail },
  { href: "#resume", label: "Resume", icon: FileText },
];

function reveal(i: number) {
  return { "--reveal-i": i } as React.CSSProperties;
}

const heroSkills = ["LLM agents", "RAG", "React", "Python"];

const heroResumeHighlights = [
  "Build production LLM data analysis agents and RAG systems for 150+ internal daily users.",
  "Ship React and TypeScript data tools backed by Python services, GCP, and large-scale streaming/social data pipelines.",
];

const heroResumeSkills = [
  "Python",
  "TypeScript",
  "React",
  "LangGraph",
  "RAG",
  "GCP",
  "BigQuery",
  "FastAPI",
];

const lapwiseViews = [
  {
    label: "Results",
    url: "https://lapwise.dev/results/2026",
    description: "Season standings, race results, and championship charts.",
  },
  {
    label: "Replay",
    url: "https://lapwise.dev/replay",
    description:
      "Lap by lap race replays visualized with telemetry and comparison tools.",
  },
  {
    label: "Home",
    url: "https://lapwise.dev",
    description: "Homepage with latest race data.",
  },
];

function LapwiseProjectSection() {
  const [activeView, setActiveView] = useState(lapwiseViews[0]);

  return (
    <section id="projects" className="scroll-mt-20">
      <h2 className="section-label">00 / project</h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div>
          <h3 className="font-heading text-3xl font-medium tracking-tight">
            Lapwise
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A Formula 1 analytics platform with race results, season standings,
            telemetry replay, driver pages, discussion threads, and an AI data
            analyst. Built with Next.js, React, FastAPI, PostgreSQL, and Python
            data pipelines.
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {["Next.js", "React", "FastAPI", "PostgreSQL", "Python"].map(
              (tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-brand/25 bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {tech}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-destructive/60" />
              <span className="size-2.5 rounded-full bg-brand-2/70" />
              <span className="size-2.5 rounded-full bg-brand/60" />
            </span>
            <span className="mx-auto truncate rounded-sm bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
              lapwise.dev
            </span>
            <a
              href="https://lapwise.dev"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-colors duration-150 hover:text-brand"
              aria-label="Open lapwise.dev in a new tab"
            >
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          <div className="border-b bg-background px-3 py-2">
            <div className="flex gap-1.5">
              {lapwiseViews.map((view) => (
                <button
                  key={view.label}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-150",
                    activeView.label === view.label
                      ? "bg-brand text-brand-contrast"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative h-[260px] overflow-hidden bg-[#11111a] sm:h-[300px]">
            <iframe
              key={activeView.url}
              src={activeView.url}
              title={`Lapwise production site: ${activeView.label}`}
              className="h-full w-full border-0 bg-[#11111a]"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
          <div className="border-t p-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.16em] text-brand uppercase">
                {activeView.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {activeView.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuenoseteolvideProjectSection() {
  return (
    <section aria-labelledby="quenoseteolvide-project-title">
      <h2 className="section-label">01 / project</h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.22fr_0.78fr] lg:items-start">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-destructive/60" />
              <span className="size-2.5 rounded-full bg-brand-2/70" />
              <span className="size-2.5 rounded-full bg-brand/60" />
            </span>
            <span className="mx-auto truncate rounded-sm bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
              colehenry.dev/quenoseteolvide/showcase
            </span>
            <Link
              href="/quenoseteolvide/showcase"
              className="text-muted-foreground transition-colors duration-150 hover:text-brand"
              aria-label="Open the Qué no se te olvide preview"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <Link
            href="/quenoseteolvide/showcase"
            className="group relative block focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
            aria-label="Explore the full Qué no se te olvide interactive preview"
          >
            <QuenoseteolvideShowcase compact />
            <span className="absolute inset-0 flex items-end justify-end bg-black/0 p-4 transition-colors duration-250 group-hover:bg-black/10 group-focus-visible:bg-black/10">
              <span className="translate-y-1 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 font-mono text-[10px] text-white opacity-0 shadow-sm transition-all duration-250 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                Open full preview ↗
              </span>
            </span>
          </Link>
        </div>

        <div>
          <h3
            id="quenoseteolvide-project-title"
            className="font-heading text-3xl font-medium tracking-tight"
            lang="es"
          >
            <Link
              href="/quenoseteolvide/showcase"
              className="transition-colors duration-150 hover:text-brand"
            >
              Qué no se te olvide
            </Link>
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A personal language-learning workspace for reading in context,
            turning unfamiliar phrases into flashcards, and retaining them
            through spaced review. The public preview uses curated sample data;
            the working app and personal study history stay private.
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {["Next.js", "React", "TypeScript", "FastAPI", "PostgreSQL"].map(
              (tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-brand/25 bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {tech}
                </span>
              ),
            )}
          </div>
          <Link
            href="/quenoseteolvide/showcase"
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs text-brand underline-offset-4 hover:underline"
          >
            Explore the view-only preview
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ResumeSnapshot() {
  return (
    <aside
      className="reveal rounded-xl border bg-card p-5 shadow-sm"
      style={reveal(2)}
      aria-label="Resume highlights"
    >
      <div>
        <p className="font-sans text-xl font-semibold leading-tight">
          AI Software Engineer{" "}
          <span className="font-medium text-muted-foreground">
            @ Interscope Records
          </span>
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-brand">
          {heroResumeHighlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </div>
      <div className="mt-5 border-t pt-4">
        <div className="flex items-center gap-2.5">
          <AppLogoIcon className="size-6 shrink-0" />
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">
              University of North Carolina at Chapel Hill
            </span>
            <span className="text-muted-foreground">
              {" "}
              Computer Science, Statistics & Analytics
            </span>
          </p>
        </div>
      </div>
      <div className="mt-5 border-t pt-4">
        <div className="flex flex-wrap gap-1.5">
          {heroResumeSkills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function HomePage() {
  return (
    <div data-section="home" className="relative">

      {/* hero */}
      <section className="relative mx-auto grid w-full max-w-5xl gap-10 px-4 pt-24 pb-20 sm:px-6 sm:pt-32 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          <h1
            className="reveal max-w-3xl font-sans text-6xl font-semibold tracking-tight text-balance sm:text-8xl"
            style={reveal(0)}
          >
            {resume.name.split(" ")[0]}{" "}
            <span className="text-carolina">{resume.name.split(" ")[1]}</span>
          </h1>
          <p
            className="reveal mt-6 max-w-xl text-xl leading-relaxed text-muted-foreground text-balance"
            style={reveal(1)}
          >
            {resume.tagline}
          </p>
          <div className="reveal mt-7 flex flex-wrap gap-2" style={reveal(2)}>
            {heroSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-brand/25 bg-card px-3 py-1 font-mono text-xs text-muted-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
          <div className="reveal mt-8 flex flex-wrap gap-2" style={reveal(3)}>
            {heroLinks.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                {...(href.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors duration-150 hover:border-brand/50 hover:text-brand"
              >
                <Icon className="size-3.5" />
                {label}
                {href.startsWith("http") && (
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                )}
              </a>
            ))}
          </div>
          <p
            className="reveal mt-10 font-mono text-xs text-muted-foreground"
            style={reveal(4)}
          >
            press{" "}
            <kbd className="rounded-sm border bg-muted px-1.5 py-0.5">⌘K</kbd>{" "}
            to look around
          </p>
        </div>
        <ResumeSnapshot />
      </section>

      {/* content sections */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-24 px-4 pb-32 sm:px-6">
        <LapwiseProjectSection />
        <QuenoseteolvideProjectSection />
        <ResumeSection />
      </div>
    </div>
  );
}
