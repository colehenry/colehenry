import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "recipes")!;

export const metadata = { title: section.name };

export default function RecipesPage() {
  return <ComingSoon section={section} />;
}
