import { CodingWorkspace } from "@/components/coding/coding-workspace";

export const metadata = {
  title: "Coding",
  description: "Private browser controller for local coding agents.",
  robots: { index: false, follow: false },
};

export default function CodingPage() {
  return <CodingWorkspace />;
}
