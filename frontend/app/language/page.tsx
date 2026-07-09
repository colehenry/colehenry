import { LanguageApp } from "@/components/language/language-app";

const description = "Flashcards, annotated texts, and French/Spanish reference.";

export const metadata = {
  title: { absolute: "Language" },
  description,
};

export default function LanguagePage() {
  return <LanguageApp />;
}
