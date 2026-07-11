import { RecipeCard } from "@/components/recipes/recipe-card";

export const metadata = {
  title: "Recipes",
};

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <RecipeCard slug={slug} />;
}
