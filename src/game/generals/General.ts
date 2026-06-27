import Phaser from "phaser";
import type { Faction, Vec2 } from "@/types/common";
import { PIXELS_PER_METER, metersToPx } from "@/game/map/mapConfig";
import {
  GENERAL_CATALOG,
  type GeneralDef,
  type GeneralId,
} from "@/game/generals/generalsCatalog";

export class General {
  public readonly scene: Phaser.Scene;
  public readonly faction: Faction;
  public readonly def: GeneralDef;
  public hp: number;
  public readonly hpMax: number;
  public attackCooldown = 0;
  public dodgeCooldown = 0;
  public alive = true;
  public body: Phaser.GameObjects.Container;
  public bodyCircle: Phaser.GameObjects.Arc;
  public facing: Vec2 = { x: 0, y: -1 };
  public attackSlowdownTimer = 0; // 攻撃中は移動速度低下
  public dodging = 0; // 残り回避時間(秒)
  public dodgeDir: Vec2 = { x: 0, y: 0 };
  // 受けている士気スキル効果
  public bonusAttackMult = 1;
  public bonusDefenseMult = 1;
  public bonusSpeedMult = 1;
  public canMove = true;
  // 固有スキル
  public uniqueCooldown = 0;
  public uniqueActiveTime = 0;

  // HPバー
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFg: Phaser.GameObjects.Rectangle;

  public constructor(
    scene: Phaser.Scene,
    faction: Faction,
    start: Vec2,
    options: {
      colorFaction?: Faction;
      flipText?: boolean;
      generalId?: GeneralId;
    } = {}
  ) {
    this.scene = scene;
    this.faction = faction;
    const def = GENERAL_CATALOG[options.generalId ?? "warrior"];
    this.def = def;
    this.hp = def.stats.hp;
    this.hpMax = def.stats.hp;
    const colorFaction = options.colorFaction ?? faction;
    const flip = options.flipText === true;

    const color = colorFaction === "ally" ? 0x3b82f6 : 0xef4444;
    this.bodyCircle = scene.add.circle(0, 0, PIXELS_PER_METER * 0.85, color, 1);
    this.bodyCircle.setStrokeStyle(3, 0xffffff, 1);

    const star = scene.add
      .text(0, 0, def.symbol, {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    if (flip) star.setRotation(Math.PI);

    this.body = scene.add.container(
      metersToPx(start.x),
      metersToPx(start.y),
      [this.bodyCircle, star]
    );
    this.body.setDepth(50);

    this.hpBarBg = scene.add
      .rectangle(0, -PIXELS_PER_METER * 1.3, 70, 8, 0x000000, 0.6)
      .setStrokeStyle(1, 0xffffff, 0.8);
    this.hpBarFg = scene.add.rectangle(
      0,
      -PIXELS_PER_METER * 1.3,
      68,
      6,
      0x22c55e
    );
    this.body.add([this.hpBarBg, this.hpBarFg]);
  }

  public get position(): Vec2 {
    return {
      x: this.body.x / PIXELS_PER_METER,
      y: this.body.y / PIXELS_PER_METER,
    };
  }

  public setPosition(p: Vec2): void {
    this.body.setPosition(metersToPx(p.x), metersToPx(p.y));
  }

  public takeDamage(dmg: number): void {
    if (!this.alive) return;
    const real = dmg / this.bonusDefenseMult;
    this.hp = Math.max(0, this.hp - real);
    if (this.hp <= 0) {
      this.alive = false;
    }
    this.updateHpBar();
  }

  private updateHpBar(): void {
    const ratio = Math.max(0, this.hp / this.hpMax);
    this.hpBarFg.width = 68 * ratio;
    const color =
      ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    this.hpBarFg.fillColor = color;
    // 左寄せにする
    this.hpBarFg.x = -34 + (68 * ratio) / 2;
  }

  public destroy(): void {
    this.body.destroy();
  }
}
