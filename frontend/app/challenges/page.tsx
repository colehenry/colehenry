import { ChallengesPage } from "@/components/challenges/challenges-page";

export const metadata = {
  title: "The 25",
  description: "Private challenge log. Owner only.",
  robots: { index: false },
};

export default function Page() {
  return <ChallengesPage />;
}
