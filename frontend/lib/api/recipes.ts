import { z } from "zod";

import { API_URL, ApiError, apiFetch } from "@/lib/api/client";

export const ingredientSchema = z.object({
  key: z.string(),
  name: z.string(),
  qty: z.number().nullable(),
  unit: z.string(),
  note: z.string(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const stepSchema = z.object({ text: z.string() });
export type Step = z.infer<typeof stepSchema>;

/** LLM translation of the text fields, keyed by locale in `translations`. */
export const translationSchema = z.object({
  title: z.string(),
  description: z.string(),
  ingredients: z.array(
    z.object({ name: z.string(), unit: z.string(), note: z.string() }),
  ),
  steps: z.array(z.object({ text: z.string() })),
});
export type RecipeTranslation = z.infer<typeof translationSchema>;

const translationsSchema = z.record(z.string(), translationSchema);

export const visibilitySchema = z.enum(["public", "passcode", "private"]);

export const recipeSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  rating: z.number(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  photo_urls: z.array(z.string()),
  tags: z.array(z.string()),
  servings: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  source_name: z.string(),
  source_url: z.string(),
  language: z.enum(["en", "es"]),
  translations: translationsSchema,
  visibility: visibilitySchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeListItemSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  rating: z.number(),
  photo_urls: z.array(z.string()),
  tags: z.array(z.string()),
  servings: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  language: z.enum(["en", "es"]),
  translations: translationsSchema,
  visibility: visibilitySchema,
  created_at: z.string(),
});
export type RecipeListItem = z.infer<typeof recipeListItemSchema>;

export type RecipeDraft = {
  title: string;
  description: string;
  rating: number;
  ingredients: Ingredient[];
  steps: Step[];
  photo_urls: string[];
  tags: string[];
  servings: number | null;
  cook_minutes: number | null;
  source_name: string;
  source_url: string;
  language: "en" | "es";
  visibility: z.infer<typeof visibilitySchema>;
};

export function listRecipes(): Promise<RecipeListItem[]> {
  return apiFetch("/recipes", z.array(recipeListItemSchema));
}

export function getRecipe(slug: string): Promise<Recipe> {
  return apiFetch(`/recipes/${encodeURIComponent(slug)}`, recipeSchema);
}

export function createRecipe(draft: RecipeDraft): Promise<Recipe> {
  return apiFetch("/recipes", recipeSchema, {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function updateRecipe(
  id: number,
  changes: Partial<RecipeDraft>,
): Promise<Recipe> {
  return apiFetch(`/recipes/${id}`, recipeSchema, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

/** Raw fetch - the endpoint returns 204 with no body to parse. */
export async function deleteRecipe(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/recipes/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}

export function retranslateRecipe(id: number): Promise<Recipe> {
  return apiFetch(`/recipes/${id}/translate`, recipeSchema, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

const photoSignatureSchema = z.object({
  cloud_name: z.string(),
  api_key: z.string(),
  timestamp: z.number(),
  signature: z.string(),
  folder: z.string(),
});

/** Direct browser → Cloudinary upload with backend-signed params. */
export async function uploadRecipePhoto(file: File): Promise<string> {
  const sig = await apiFetch("/recipes/photo-signature", photoSignatureSchema, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.api_key);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error(`Photo upload failed (${res.status})`);
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("Photo upload returned no URL");
  return data.secure_url;
}
