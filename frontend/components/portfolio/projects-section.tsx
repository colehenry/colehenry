"use client";

import { useQuery } from "@tanstack/react-query";

import { ProjectCard } from "@/components/portfolio/project-card";
import { listProjects } from "@/lib/api/projects";
import { useMe } from "@/lib/hooks/use-me";

export function ProjectsSection() {
  const { me } = useMe();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  return (
    <section id="projects" className="scroll-mt-20">
      <h2 className="section-label">01 / projects</h2>
      <div className="mt-6 grid gap-5">
        {isLoading && (
          <>
            <div className="h-40 animate-pulse rounded-xl border bg-muted" />
            <div className="h-40 animate-pulse rounded-xl border bg-muted" />
          </>
        )}
        {isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
            <p className="font-medium">Couldn&apos;t load projects.</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-sm text-brand underline-offset-4 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {data?.map((project) => (
          <ProjectCard key={project.id} project={project} isOwner={!!me} />
        ))}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No projects yet — run the seed script.
          </p>
        )}
      </div>
    </section>
  );
}
