import { useSessionStore } from "@/store/sessionStore";
import { TitlePage } from "@/pages/TitlePage";
import { GeneralSelectPage } from "@/pages/GeneralSelectPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { BattlePage } from "@/pages/BattlePage";
import { ResultPage } from "@/pages/ResultPage";
import { OrientationGuard } from "@/components/hud/OrientationGuard";

function App(): JSX.Element {
  const view = useSessionStore((s) => s.view);
  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 text-white">
      {view === "title" && <TitlePage />}
      {view === "select" && <GeneralSelectPage />}
      {view === "lobby" && <LobbyPage />}
      {view === "battle" && <BattlePage />}
      {view === "result" && <ResultPage />}
      <OrientationGuard />
    </div>
  );
}

export default App;
