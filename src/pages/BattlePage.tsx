import { useEffect } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { TopBar } from "@/components/hud/TopBar";
import { VirtualStick } from "@/components/hud/VirtualStick";
import { ActionButtons } from "@/components/hud/ActionButtons";
import { UnitPanel } from "@/components/hud/UnitPanel";
import { MoraleSkillBar } from "@/components/hud/MoraleSkillBar";
import { PauseOverlay } from "@/components/hud/PauseOverlay";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

export function BattlePage(): JSX.Element {
  const status = useGameStore((s) => s.status);
  const setView = useSessionStore((s) => s.setView);

  useEffect(() => {
    if (status === "victory" || status === "defeat") {
      const t = setTimeout(() => setView("result"), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, setView]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 text-white">
      <GameCanvas />
      <TopBar />
      <MoraleSkillBar />
      <UnitPanel />
      <VirtualStick />
      <ActionButtons />
      <PauseOverlay />
    </div>
  );
}
