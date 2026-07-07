import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "challenges")!;

export const metadata = { title: section.name };

export default function ChallengesPage() {
  return <ComingSoon section={section} />;
}
