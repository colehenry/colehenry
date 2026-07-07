import { ArrowUpRight, FileText, Mail } from "lucide-react";

import { GitHubIcon, LinkedInIcon } from "@/components/icons";
import { ProjectsSection } from "@/components/portfolio/projects-section";
import { ResumeSection } from "@/components/portfolio/resume-section";
import { WidgetStubs } from "@/components/portfolio/widget-stubs";
import { resume } from "@/lib/resume";

const heroLinks = [
  { href: resume.github, label: "GitHub", icon: GitHubIcon },
  { href: resume.linkedin, label: "LinkedIn", icon: LinkedInIcon },
  { href: `mailto:${resume.email}`, label: "Email", icon: Mail },
  { href: "#resume", label: "Resume", icon: FileText },
];

function reveal(i: number) {
  return { "--reveal-i": i } as React.CSSProperties;
}

export default function HomePage() {
  return (
    <div data-section="home" className="relative">
      <div className="bg-grid absolute inset-x-0 top-0 h-[28rem]" aria-hidden />

      {/* hero */}
      <section className="relative mx-auto w-full max-w-5xl px-4 pt-24 pb-20 sm:px-6 sm:pt-32">
        <p className="section-label reveal" style={reveal(0)}>
          full-stack ai engineer
        </p>
        <h1
          className="reveal mt-5 max-w-3xl text-5xl font-medium tracking-tight text-balance sm:text-7xl"
          style={reveal(1)}
        >
          {resume.name.split(" ")[0]}{" "}
          <span className="text-brand">{resume.name.split(" ")[1]}</span>
          <span className="text-brand-2">.</span>
        </h1>
        <p
          className="reveal mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          style={reveal(2)}
        >
          I build production LLM agents and the platforms around them —
          Python and LangGraph on the back, React and TypeScript on the
          front. This site is both the portfolio and the workshop: every tool
          on it is something I actually use.
        </p>
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
          press <kbd className="rounded-sm border bg-muted px-1.5 py-0.5">⌘K</kbd>{" "}
          to look around
        </p>
      </section>

      {/* content sections */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-24 px-4 pb-32 sm:px-6">
        <ProjectsSection />
        <ResumeSection />
        <WidgetStubs />
      </div>
    </div>
  );
}
