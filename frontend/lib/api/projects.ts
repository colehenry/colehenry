import { z } from "zod";

import { apiFetch } from "@/lib/api/client";

export const projectSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  description_md: z.string(),
  tech: z.array(z.string()),
  repo_url: z.string().nullable(),
  live_url: z.string().nullable(),
  embed_url: z.string().nullable(),
  screenshot_url: z.string().nullable(),
  sort_order: z.number(),
  featured: z.boolean(),
  visibility: z.enum(["public", "passcode", "private"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export type ProjectUpdate = Partial<
  Pick<
    Project,
    | "title"
    | "summary"
    | "description_md"
    | "tech"
    | "repo_url"
    | "live_url"
    | "embed_url"
    | "sort_order"
    | "featured"
    | "visibility"
  >
>;

export function listProjects(): Promise<Project[]> {
  return apiFetch("/projects", z.array(projectSchema));
}

export function updateProject(
  id: number,
  patch: ProjectUpdate,
): Promise<Project> {
  return apiFetch(`/projects/${id}`, projectSchema, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
