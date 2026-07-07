import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "journal")!;

export const metadata = { title: section.name };

export default function JournalPage() {
  return <ComingSoon section={section} />;
}
