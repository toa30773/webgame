import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BattleScene } from "@/game/scenes/BattleScene";

export function GameCanvas(): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      backgroundColor: "#0f172a",
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BattleScene],
      fps: { target: 60, forceSetTimeOut: false },
      banner: false,
      audio: { disableWebAudio: true },
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={ref} className="absolute inset-0" />;
}
