import { useEffect } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { TopBar } from "@/components/hud/TopBar";
import { VirtualStick } from "@/components/hud/VirtualStick";
import { ActionButtons } from "@/components/hud/ActionButtons";
import { UnitPanel } from "@/components/hud/UnitPanel";
import { MoraleSkillBar } from "@/components/hud/MoraleSkillBar";
import { PauseOverlay } from "@/components/hud/PauseOverlay";
import { PlacementOverlay } from "@/components/hud/PlacementOverlay";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

export function BattlePage(): JSX.Element {
  const status = useGameStore((s) => s.status);
  const phase = useGameStore((s) => s.phase);
  const setView = useSessionStore((s) => s.setView);

  // BattleScene.create() が走るまでの一瞬、前試合の battle HUD が見えないよう先に placement に
  useEffect(() => {
    const g = useGameStore.getState();
    g.setPhase("placement");
    g.setPlacementTimeLeft(30);
    g.setPlacementSelected(null);
  }, []);

  useEffect(() => {
    if (status === "victory" || status === "defeat") {
      const t = setTimeout(() => setView("result"), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, setView]);

  const inBattle = phase === "battle";

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 text-white">
      <GameCanvas />
      {inBattle && (
        <>
          <TopBar />
          <MoraleSkillBar />
          <UnitPanel />
          <VirtualStick />
          <ActionButtons />
          <PauseOverlay />
        </>
      )}
      <PlacementOverlay />
    </div>
  );
}
