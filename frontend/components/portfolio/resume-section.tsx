"use client";

import { Download } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { localizeDate, useLocale } from "@/lib/i18n/locale";
import { ui } from "@/lib/i18n/ui";
import { resume, type Bullet } from "@/lib/resume";

function HighlightedBullet({ bullet }: { bullet: Bullet }) {
  if (!bullet.highlights?.length) return <>{bullet.text}</>;

  const parts: React.ReactNode[] = [];
  let remaining = bullet.text;

  bullet.highlights.forEach((highlight) => {
    const index = remaining.indexOf(highlight);
    if (index === -1) return;

    if (index > 0) {
      parts.push(remaining.slice(0, index));
    }
    parts.push(
      <strong key={`${highlight}-${parts.length}`} className="font-semibold text-foreground">
        {highlight}
      </strong>,
    );
    remaining = remaining.slice(index + highlight.length);
  });

  if (remaining) parts.push(remaining);

  return <>{parts}</>;
}

export function ResumeSection() {
  const { locale, t } = useLocale();
  const strings = ui[locale].resume;
  const labels = ui[locale].home;

  return (
    <section id="resume" className="scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="section-label">01 / {labels.resumeWord}</h2>
        <Button variant="outline" size="sm" asChild>
          <a href={resume.pdf} download>
            <Download className="size-4" />
            {strings.downloadPdf}
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
                {localizeDate(job.start, locale)} —{" "}
                {localizeDate(job.end, locale)}
                {job.location ? ` · ${t(job.location)}` : ""}
              </p>
              <h3 className="mt-1 font-sans text-lg font-semibold tracking-normal">
                {t(job.role)}{" "}
                <span className="font-medium text-muted-foreground">
                  @ {job.company}
                </span>
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-brand">
                {job.bullets.map((b) => (
                  <li key={b.en.text}>
                    <HighlightedBullet bullet={t(b)} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.tech.map((tech) => (
                  <Badge
                    key={tech}
                    variant="outline"
                    className="border-brand/25 font-mono text-[11px] font-normal text-muted-foreground"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* education + skills rail */}
        <div className="flex flex-col gap-10">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
              {strings.education}
            </h3>
            {resume.education.map((edu) => (
              <div key={edu.school} className="mt-4">
                <div className="relative mb-4 aspect-[3/2] overflow-hidden rounded-md border bg-muted">
                  <Image
                    src="/old-well.png"
                    alt="The Old Well at the University of North Carolina at Chapel Hill"
                    fill
                    className="object-cover"
                    sizes="(min-width: 768px) 260px, calc(100vw - 40px)"
                    priority={false}
                  />
                </div>
                <p className="font-sans text-lg font-semibold leading-tight">
                  {edu.school}
                </p>
                <div className="mt-3 space-y-1.5">
                  {t(edu.degrees).map((degree) => (
                    <p key={degree} className="text-sm font-semibold text-foreground">
                      {degree}
                    </p>
                  ))}
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {edu.start} — {edu.end}
                </p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
              {strings.languages}
            </h3>
            <div className="mt-3 grid gap-2">
              {resume.languages.map((item) => (
                <div
                  key={item.language.en}
                  className="flex items-center justify-between border-b pb-2 text-sm last:border-b-0"
                >
                  <span className="font-medium">{t(item.language)}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {t(item.level)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
              {strings.skills}
            </h3>
            <div className="mt-3 flex flex-col gap-4">
              {resume.skills.map((group) => (
                <div key={group.label.en}>
                  <p className="text-xs text-muted-foreground">
                    {t(group.label)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="font-mono text-[11px] font-normal"
                      >
                        {skill}
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
