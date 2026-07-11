import "@/components/recipes/blog.css";

export default function RecipesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-section="recipes">{children}</div>;
}
