import { BrainChat } from "@/components/brain/brain-chat";

export const metadata = {
  title: "Brain",
  description: "Private second-brain vault. Owner only.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BrainChat />;
}
