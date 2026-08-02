import { CambioLobby } from "@/components/cambio/lobby";

const description =
  "Cambio - realtime card game: play the bot or invite a friend, three card skins, live odds.";

export const metadata = {
  title: "Cambio",
  description,
};

export default function CambioPage() {
  return <CambioLobby />;
}
