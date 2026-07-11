import { LanguageApp } from "@/components/language/language-app";

const description =
  "Read in context, capture useful phrases, and remember them with spaced repetition.";

export const metadata = {
  title: { absolute: "Qué no se te olvide" },
  description,
};

export default function QueNoSeTeOlvidePage() {
  return <LanguageApp />;
}
