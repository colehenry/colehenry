import { CatanDashboardPage } from "@/components/catan/catan-dashboard";

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
  return <CatanDashboardPage />;
}
