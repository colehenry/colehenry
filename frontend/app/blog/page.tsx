import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "blog")!;

export const metadata = { title: section.name };

export default function BlogPage() {
  return <ComingSoon section={section} />;
}
