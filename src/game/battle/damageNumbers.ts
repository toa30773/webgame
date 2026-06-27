import Phaser from "phaser";

export function showDamageNumber(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  amount: number,
  variant: "normal" | "favorable" | "critical" = "normal",
  flipText = false
): void {
  const color =
    variant === "favorable"
      ? "#fbbf24"
      : variant === "critical"
      ? "#f87171"
      : "#ffffff";
  const text = scene.add
    .text(worldX, worldY - 12, String(Math.round(amount)), {
      fontSize: "13px",
      color,
      fontStyle: "bold",
      stroke: "#000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(200);
  if (flipText) text.setRotation(Math.PI);
  scene.tweens.add({
    targets: text,
    y: worldY - 36,
    alpha: 0,
    duration: 600,
    ease: "Quad.easeOut",
    onComplete: () => text.destroy(),
  });
}
