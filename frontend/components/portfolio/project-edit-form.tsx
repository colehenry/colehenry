"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  updateProject,
  type Project,
  type ProjectUpdate,
} from "@/lib/api/projects";

/**
 * Inline owner edit form. This is the reference pattern every future tool's
 * edit UI follows: local form state → PATCH → invalidate the query.
 */
export function ProjectEditForm({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: project.title,
    summary: project.summary,
    repo_url: project.repo_url ?? "",
    live_url: project.live_url ?? "",
    embed_url: project.embed_url ?? "",
    tech: project.tech.join(", "),
    sort_order: project.sort_order,
    featured: project.featured,
  });

  const mutation = useMutation({
    mutationFn: (patch: ProjectUpdate) => updateProject(project.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onDone();
    },
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      title: form.title,
      summary: form.summary,
      repo_url: form.repo_url || null,
      live_url: form.live_url || null,
      embed_url: form.embed_url || null,
      tech: form.tech
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sort_order: Number(form.sort_order) || 0,
      featured: form.featured,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-4 rounded-lg border border-brand/25 bg-brand/[0.03] p-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`title-${project.id}`}>Title</Label>
        <Input
          id={`title-${project.id}`}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`summary-${project.id}`}>Summary</Label>
        <Textarea
          id={`summary-${project.id}`}
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`repo-${project.id}`}>Repo URL</Label>
          <Input
            id={`repo-${project.id}`}
            value={form.repo_url}
            onChange={(e) => set("repo_url", e.target.value)}
            placeholder="https://github.com/…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`live-${project.id}`}>Live URL</Label>
          <Input
            id={`live-${project.id}`}
            value={form.live_url}
            onChange={(e) => set("live_url", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`embed-${project.id}`}>Embed URL</Label>
          <Input
            id={`embed-${project.id}`}
            value={form.embed_url}
            onChange={(e) => set("embed_url", e.target.value)}
            placeholder="https://… (shown in the iframe)"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`tech-${project.id}`}>Tech (comma-separated)</Label>
          <Input
            id={`tech-${project.id}`}
            value={form.tech}
            onChange={(e) => set("tech", e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id={`featured-${project.id}`}
            checked={form.featured}
            onCheckedChange={(v) => set("featured", v)}
          />
          <Label htmlFor={`featured-${project.id}`}>Featured</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`sort-${project.id}`}>Sort</Label>
          <Input
            id={`sort-${project.id}`}
            type="number"
            className="w-20"
            value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))}
          />
        </div>
      </div>
      {mutation.isError && (
        <p className="text-sm text-destructive">
          Save failed: {mutation.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
