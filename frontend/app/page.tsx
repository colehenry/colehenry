"use client";

import { ArrowUpRight, FileText, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { BrainShowcaseLazy } from "@/components/brain/brain-showcase-lazy";
import { AppLogoIcon, GitHubIcon, LinkedInIcon } from "@/components/icons";
import { QuenoseteolvideShowcaseLazy } from "@/components/language/quenoseteolvide-showcase-lazy";
import {
  HighlightedText,
  type HighlightableText,
} from "@/components/portfolio/highlighted-text";
import { ResumeSection } from "@/components/portfolio/resume-section";
import { useLocale, type Localized } from "@/lib/i18n/locale";
import { ui } from "@/lib/i18n/ui";
import { resume } from "@/lib/resume";
import { cn } from "@/lib/utils";

const heroLinks: Array<{
  href: string;
  label: Localized<string>;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    href: resume.github,
    label: { en: "GitHub", es: "GitHub" },
    icon: GitHubIcon,
  },
  {
    href: resume.linkedin,
    label: { en: "LinkedIn", es: "LinkedIn" },
    icon: LinkedInIcon,
  },
  {
    href: `mailto:${resume.email}`,
    label: { en: "Email", es: "Correo" },
    icon: Mail,
  },
  {
    href: "#resume",
    label: { en: "Resume", es: "Currículum" },
    icon: FileText,
  },
];

function reveal(i: number) {
  return { "--reveal-i": i } as React.CSSProperties;
}

const heroSkills = ["LLM agents", "RAG", "React", "Python"];

const heroResumeHighlights: Localized<string[]> = {
  en: [
    "Build production LLM data analysis agents and RAG systems for 150+ internal daily users.",
    "Ship React and TypeScript data tools backed by Python services, GCP, and large-scale streaming/social data pipelines.",
  ],
  es: [
    "Construyo agentes LLM de análisis de datos y sistemas RAG en producción para más de 150 usuarios internos diarios.",
    "Desarrollo herramientas de datos en React y TypeScript respaldadas por servicios en Python, GCP y pipelines de datos de streaming y redes sociales a gran escala.",
  ],
};

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

const lapwiseDescription: Localized<HighlightableText> = {
  en: {
    text: "Explore race results, season standings, telemetry replay, driver history, discussion, and natural-language analysis. Python pipelines model 76 seasons of race and telemetry data for a FastAPI and PostgreSQL backend.",
    highlights: ["telemetry replay", "natural-language analysis", "76 seasons"],
  },
  es: {
    text: "Explora resultados de carreras, clasificaciones de temporada, repetición de telemetría, historiales de pilotos, debate y análisis en lenguaje natural. Pipelines en Python modelan 76 temporadas de datos de carreras y telemetría para un backend en FastAPI y PostgreSQL.",
    highlights: [
      "repetición de telemetría",
      "análisis en lenguaje natural",
      "76 temporadas",
    ],
  },
};

const lapwiseStatus: Localized<string> = {
  en: "Formula 1 Analytics Platform",
  es: "Plataforma de Analítica de Fórmula 1",
};

const lapwiseViews: Array<{
  url: string;
  image: string;
  label: Localized<string>;
  description: Localized<string>;
}> = [
  {
    url: "https://lapwise.dev/results/2026",
    image: "/lapwise/results.png",
    label: { en: "Results", es: "Resultados" },
    description: {
      en: "Season standings, race results, and championship charts.",
      es: "Clasificaciones de temporada, resultados de carreras y gráficos del campeonato.",
    },
  },
  {
    url: "https://lapwise.dev/replay",
    image: "/lapwise/replay.png",
    label: { en: "Replay", es: "Repetición" },
    description: {
      en: "Lap by lap race replays visualized with telemetry and comparison tools.",
      es: "Repeticiones de carreras vuelta a vuelta visualizadas con telemetría y herramientas de comparación.",
    },
  },
  {
    url: "https://lapwise.dev/ask",
    image: "/lapwise/ai.png",
    label: { en: "AI", es: "IA" },
    description: {
      en: "Ask an AI data analyst natural-language questions about race results, standings, and telemetry.",
      es: "Hazle preguntas en lenguaje natural a un analista de datos con IA sobre resultados de carreras, clasificaciones y telemetría.",
    },
  },
];

const brainDescription: Localized<HighlightableText> = {
  en: {
    text: "I got tired of switching between projects, LLMs, and tools, so I built one chatbot with all of my personal context in the same place. I now use it every day for quick questions about my projects, deployments, notes, and plans.",
    highlights: ["all of my personal context in the same place", "every day"],
  },
  es: {
    text: "Me cansé de cambiar entre proyectos, LLM y herramientas, así que construí un solo chatbot con todo mi contexto personal en el mismo lugar. Ahora lo uso todos los días para preguntas rápidas sobre mis proyectos, despliegues, notas y planes.",
    highlights: [
      "todo mi contexto personal en el mismo lugar",
      "todos los días",
    ],
  },
};

const brainSummary: Localized<string> = {
  en: "Chatbot w/ Personalized Context",
  es: "Chatbot con Contexto Personal",
};

const brainExplore: Localized<string> = {
  en: "Explore example conversations",
  es: "Explorar conversaciones de ejemplo",
};

const quenoseteolvideDescription: Localized<HighlightableText[]> = {
  en: [
    {
      text: "I use Spanish as a bridge into French.",
      highlights: ["Spanish", "bridge into French"],
    },
    {
      text: "The read-only React preview uses live FastAPI data for side-by-side FR/ES conjugations, cognate notes, and faux-ami warnings.",
      highlights: ["read-only React preview", "live FastAPI data"],
    },
  ],
  es: [
    {
      text: "Uso mi español (C1) como puente hacia el francés.",
      highlights: ["español (C1)", "puente hacia el francés"],
    },
    {
      text: "La vista previa de solo lectura en React usa datos en vivo de FastAPI para mostrar conjugaciones FR/ES en paralelo, notas de cognados y avisos de falsos amigos.",
      highlights: [
        "vista previa de solo lectura en React",
        "datos en vivo de FastAPI",
      ],
    },
  ],
};

const quenoseteolvideStatus: Localized<string> = {
  en: "French Through Spanish Learning App",
  es: "Aplicación para Aprender Francés a Través del Español",
};

const quenoseteolvideOpenPreview: Localized<string> = {
  en: "Open the live preview ↗",
  es: "Abrir la vista previa en vivo ↗",
};

const quenoseteolvideExplore: Localized<string> = {
  en: "Explore the live app (read-only)",
  es: "Explora la aplicación real (solo lectura)",
};

function LapwiseProjectSection() {
  const { locale, t } = useLocale();
  const [activeView, setActiveView] = useState(lapwiseViews[0]);

  return (
    <section
      id="projects"
      className="scroll-mt-20"
      style={{ viewTransitionName: "project-lapwise" }}
    >
      <h2 className="section-label">00 / {ui[locale].home.projectWord}</h2>
      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div>
          <h3 className="font-heading text-3xl font-medium tracking-tight">
            <a
              href="https://lapwise.dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 transition-colors duration-150 hover:text-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              Lapwise
              <ArrowUpRight className="size-5" />
            </a>
          </h3>
          <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-brand uppercase">
            {t(lapwiseStatus)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <HighlightedText value={t(lapwiseDescription)} />
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
          <a
            href="https://lapwise.dev"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs text-brand underline-offset-4 hover:underline"
          >
            {t({ en: "Visit lapwise.dev", es: "Visitar lapwise.dev" })}
            <ArrowUpRight className="size-3.5" />
          </a>
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
                  key={view.url}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-150",
                    activeView.url === view.url
                      ? "bg-brand text-brand-contrast"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t(view.label)}
                </button>
              ))}
            </div>
          </div>
          <a
            href={activeView.url}
            target="_blank"
            rel="noreferrer"
            className="group relative block h-[260px] overflow-hidden bg-[#11111a] sm:h-[300px]"
            aria-label={`Open Lapwise production site: ${activeView.label.en}`}
          >
            <Image
              key={activeView.url}
              src={activeView.image}
              alt={`Lapwise ${activeView.label.en} screenshot`}
              fill
              // these render ~300px tall in the card; 100 was spending roughly
              // double the bytes on detail the card can't show
              quality={85}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </a>
          <div className="border-t p-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.16em] text-brand uppercase">
                {t(activeView.label)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(activeView.description)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrainProjectSection() {
  const { t } = useLocale();

  return (
    <section
      aria-labelledby="brain-project-title"
      style={{ viewTransitionName: "project-brain" }}
    >
      <div className="grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[1.22fr_0.78fr] lg:items-start">
        <div className="lg:order-2">
          <h3
            id="brain-project-title"
            className="font-heading text-3xl font-medium tracking-tight"
          >
            <Link
              href="/brain/examples"
              className="inline-flex items-center gap-2 transition-colors duration-150 hover:text-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              Brain
              <ArrowUpRight className="size-5" />
            </Link>
          </h3>
          <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-brand uppercase">
            {t(brainSummary)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <HighlightedText value={t(brainDescription)} />
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {[
              "Next.js",
              "React",
              "FastAPI",
              "PostgreSQL",
              "Obsidian",
              "SSE",
            ].map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-brand/25 bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
          <Link
            href="/brain/examples"
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs text-brand underline-offset-4 hover:underline"
          >
            {t(brainExplore)}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm lg:order-1">
          <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-destructive/60" />
              <span className="size-2.5 rounded-full bg-brand-2/70" />
              <span className="size-2.5 rounded-full bg-brand/60" />
            </span>
            <span className="mx-auto truncate rounded-sm bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
              colehenry.dev/brain/examples
            </span>
            <Link
              href="/brain/examples"
              className="text-muted-foreground transition-colors duration-150 hover:text-brand"
              aria-label="Open the Brain interactive demo"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <BrainShowcaseLazy />
        </div>
      </div>
    </section>
  );
}

function QuenoseteolvideProjectSection() {
  const { t } = useLocale();

  return (
    <section
      aria-labelledby="quenoseteolvide-project-title"
      style={{ viewTransitionName: "project-quenoseteolvide" }}
    >
      <div className="grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div className="order-2 overflow-hidden rounded-xl border bg-card shadow-sm">
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
            <QuenoseteolvideShowcaseLazy compact />
            <span className="absolute inset-0 flex items-end justify-end bg-black/0 p-4 transition-colors duration-250 group-hover:bg-black/10 group-focus-visible:bg-black/10">
              <span className="translate-y-1 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 font-mono text-[10px] text-white opacity-0 shadow-sm transition-all duration-250 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                {t(quenoseteolvideOpenPreview)}
              </span>
            </span>
          </Link>
        </div>

        <div className="order-1">
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
          <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-brand uppercase">
            {t(quenoseteolvideStatus)}
          </p>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {t(quenoseteolvideDescription).map((paragraph) => (
              <p key={paragraph.text}>
                <HighlightedText value={paragraph} />
              </p>
            ))}
          </div>
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
            {t(quenoseteolvideExplore)}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ResumeSnapshot() {
  const { locale, t } = useLocale();

  return (
    <aside
      className="reveal rounded-xl border bg-card p-5 shadow-sm"
      style={{ ...reveal(2), viewTransitionName: "hero-aside" }}
      aria-label={ui[locale].home.resumeAside}
    >
      <div>
        <p className="font-sans text-xl font-semibold leading-tight">
          {t(resume.experience[0].role)}{" "}
          <span className="font-medium text-muted-foreground">
            @ Interscope Records
          </span>
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-brand">
          {t(heroResumeHighlights).map((highlight) => (
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
              {t({
                en: "Computer Science, Statistics & Analytics",
                es: "Informática, Estadística y Analítica",
              })}
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
  const { locale, t } = useLocale();
  const home = ui[locale].home;

  return (
    <div data-section="home" className="relative">
      {/* hero */}
      <section
        className="relative mx-auto grid w-full max-w-5xl gap-6 px-4 pt-5 pb-10 sm:gap-10 sm:px-6 sm:pt-32 sm:pb-20 lg:grid-cols-[1fr_360px] lg:items-start"
        style={{ viewTransitionName: "hero" }}
      >
        <div>
          <h1
            className="reveal max-w-3xl font-sans text-6xl font-semibold tracking-tight text-balance sm:text-8xl"
            style={reveal(0)}
          >
            {resume.name.split(" ")[0]}{" "}
            <span className="text-carolina">{resume.name.split(" ")[1]}</span>
          </h1>
          <p
            className="reveal mt-4 max-w-xl text-xl leading-relaxed text-muted-foreground text-balance sm:mt-6"
            style={reveal(1)}
          >
            {t(resume.tagline)}
          </p>
          <div
            className="reveal mt-5 flex flex-wrap gap-2 sm:mt-7"
            style={reveal(2)}
          >
            {heroSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-brand/25 bg-card px-3 py-1 font-mono text-xs text-muted-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
          <div
            className="reveal mt-5 flex flex-wrap gap-2 sm:mt-8"
            style={reveal(3)}
          >
            {heroLinks.map(({ href, label, icon: Icon }) => (
              <a
                key={label.en}
                href={href}
                {...(href.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors duration-150 hover:border-brand/50 hover:text-brand"
              >
                <Icon className="size-3.5" />
                {t(label)}
                {href.startsWith("http") && (
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                )}
              </a>
            ))}
          </div>
          <p
            className="reveal mt-10 hidden font-mono text-xs text-muted-foreground sm:block"
            style={reveal(4)}
          >
            {home.kbdBefore}{" "}
            <kbd className="rounded-sm border bg-muted px-1.5 py-0.5">⌘K</kbd>{" "}
            {home.kbdAfter}
          </p>
        </div>
        <ResumeSnapshot />
      </section>

      {/* content sections */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-20 sm:gap-24 sm:px-6 sm:pb-32">
        <LapwiseProjectSection />
        <BrainProjectSection />
        <QuenoseteolvideProjectSection />
        <ResumeSection />
      </div>
    </div>
  );
}
