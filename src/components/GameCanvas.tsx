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
      backgroundColor: "rgba(0,0,0,0)",
      transparent: true,
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
    // Phaser キャンバスは 3D の上に重ね、入力 / HUD を担当する。
    const styleCanvas = (): void => {
      const c = game.canvas;
      if (!c) return;
      c.style.position = "absolute";
      c.style.inset = "0";
      c.style.zIndex = "2";
      c.style.background = "transparent";
    };
    styleCanvas();
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={ref} className="absolute inset-0" />;
}
