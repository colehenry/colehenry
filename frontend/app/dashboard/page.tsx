import { ComingSoon } from "@/components/coming-soon";
import { sections } from "@/lib/sections";

const section = sections.find((s) => s.slug === "dashboard")!;

export const metadata = { title: section.name };

export default function DashboardPage() {
  return <ComingSoon section={section} />;
}
