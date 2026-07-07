import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "catan")!;

export const metadata = { title: section.name };

export default function CatanPage() {
  return <ComingSoon section={section} />;
}
