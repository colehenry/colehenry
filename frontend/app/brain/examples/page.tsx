import { BrainShowcase } from "@/components/brain/brain-showcase";

const description =
  "Example conversations from Cole Henry's personal context chatbot.";

export const metadata = {
  title: "Brain | Examples",
  description,
  robots: { index: false, follow: false },
};

export default function BrainExamplesPage() {
  return <BrainShowcase />;
}
