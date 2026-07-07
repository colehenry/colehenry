import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "language")!;

export const metadata = { title: section.name };

export default function LanguagePage() {
  return <ComingSoon section={section} />;
}
