"use client";

import { ArrowUpRight, Pencil } from "lucide-react";
import { useState } from "react";

import { GitHubIcon } from "@/components/icons";

import { ProjectEditForm } from "@/components/portfolio/project-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/api/projects";

/** Browser-chrome frame around the featured project's live iframe. */
function EmbedFrame({ project }: { project: Project }) {
  if (!project.embed_url) return null;
  return (
    <div className="overflow-hidden rounded-lg border shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-brand-2/70" />
          <span className="size-2.5 rounded-full bg-brand/60" />
        </span>
        <span className="mx-auto truncate rounded-sm bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
          {project.embed_url.replace(/^https?:\/\//, "")}
        </span>
        <a
          href={project.embed_url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors duration-150 hover:text-brand"
          aria-label={`Open ${project.title} in a new tab`}
        >
          <ArrowUpRight className="size-4" />
        </a>
      </div>
      <iframe
        src={project.embed_url}
        title={`${project.title} — live demo`}
        className="h-[420px] w-full bg-background"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}

export function ProjectCard({
  project,
  isOwner,
}: {
  project: Project;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="group rounded-xl border bg-card p-6 transition-colors duration-250 hover:border-brand/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-xl font-medium tracking-tight">
            {project.live_url ? (
              <a
                href={project.live_url}
                target="_blank"
                rel="noreferrer"
                className="transition-colors duration-150 hover:text-brand"
              >
                {project.title}
              </a>
            ) : (
              project.title
            )}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {project.summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.title} source on GitHub`}
              className="rounded-md p-2 text-muted-foreground transition-colors duration-150 hover:text-brand"
            >
              <GitHubIcon className="size-4" />
            </a>
          )}
          {project.live_url && (
            <a
              href={project.live_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${project.title}`}
              className="rounded-md p-2 text-muted-foreground transition-colors duration-150 hover:text-brand"
            >
              <ArrowUpRight className="size-4" />
            </a>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${project.title}`}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {project.tech.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.tech.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-brand/25 font-mono text-[11px] font-normal text-muted-foreground"
            >
              {t}
            </Badge>
          ))}
        </div>
      )}

      {project.featured && (
        <div className="mt-5">
          <EmbedFrame project={project} />
        </div>
      )}

      {editing && (
        <ProjectEditForm project={project} onDone={() => setEditing(false)} />
      )}
    </article>
  );
}
