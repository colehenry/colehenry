import { CatanDashboardPage } from "@/components/catan/catan-dashboard";
import { Toaster } from "@/components/ui/sonner";

const description = "Game log and standings for the home Catan table.";

export const metadata = {
  title: { absolute: "Champions League" },
  description,
  openGraph: {
    title: "Catan Champions League",
    description,
    images: [{ url: "/catan/champions.png", width: 1024, height: 768 }],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Catan Champions League",
    description,
    images: ["/catan/champions.png"],
  },
};

export default function CatanPage() {
  return (
    <>
      <CatanDashboardPage />
      {/* the game editor/summary dialogs toast on save and delete; catan is the
          only route that does, so the Toaster mounts here rather than in the
          root layout and keeps sonner out of every other page's bundle */}
      <Toaster />
    </>
  );
}
