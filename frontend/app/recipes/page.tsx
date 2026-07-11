import { RecipeBox } from "@/components/recipes/recipe-box";

const description =
  "colehenry@kitchen:~$ — recipes I actually cook, rated out of 5.";

export const metadata = {
  title: "Recipes",
  description,
};

export default function RecipesPage() {
  return <RecipeBox />;
}
