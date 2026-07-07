import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resume } from "@/lib/resume";

export function ResumeSection() {
  return (
    <section id="resume" className="scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="section-label">02 / resume</h2>
        <Button variant="outline" size="sm" asChild>
          <a href={resume.pdf} download>
            <Download className="size-4" />
            Download PDF
          </a>
        </Button>
      </div>

      <div className="mt-8 grid gap-12 md:grid-cols-[1fr_260px]">
        {/* experience timeline */}
        <div className="relative flex flex-col gap-10 border-l border-brand/25 pl-6">
          {resume.experience.map((job) => (
            <div key={`${job.company}-${job.start}`} className="relative">
              <span
                className="absolute top-1.5 -left-[1.85rem] size-2.5 rounded-full border-2 border-brand bg-background"
                aria-hidden
              />
              <p className="font-mono text-xs text-muted-foreground">
                {job.start} — {job.end}
                {job.location ? ` · ${job.location}` : ""}
              </p>
              <h3 className="mt-1 font-serif text-lg font-medium">
                {job.role}{" "}
                <span className="text-muted-foreground">@ {job.company}</span>
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-brand">
                {job.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.tech.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="border-brand/25 font-mono text-[11px] font-normal text-muted-foreground"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* education + skills rail */}
        <div className="flex flex-col gap-10">
          <div>
            <h3 className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
              Education
            </h3>
            {resume.education.map((edu) => (
              <div key={edu.school} className="mt-3">
                <p className="text-sm font-medium">{edu.school}</p>
                <p className="text-sm text-muted-foreground">{edu.degree}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {edu.start} — {edu.end}
                </p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
              Skills
            </h3>
            <div className="mt-3 flex flex-col gap-4">
              {resume.skills.map((group) => (
                <div key={group.label}>
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.skills.map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="font-mono text-[11px] font-normal"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
