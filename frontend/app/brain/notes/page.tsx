import { BrainNotes } from "@/components/brain/brain-notes";

export const metadata = {
  title: "Brain · Notes",
  description: "Private second-brain vault. Owner only.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BrainNotes />;
}
