import Phaser from "phaser";
import type {
  CommandType,
  Faction,
  Lane,
  UnitType,
  Vec2,
} from "@/types/common";
import { UNIT_STATS } from "@/game/skills/balance";
import { PIXELS_PER_METER, metersToPx } from "@/game/map/mapConfig";

export class Unit {
  public readonly scene: Phaser.Scene;
  public readonly type: UnitType;
  public readonly faction: Faction;
  public hp: number;
  public readonly hpMax: number;
  public readonly soldiersMax: number;
  public soldiers: number;
  public alive = true;
  public respawnIn = 0;
  public lane: Lane;
  public command: CommandType = "advance";
  public attackCooldown = 0;
  public aiCooldown = 0;
  public bonusAttackMult = 1;
  public bonusDefenseMult = 1;
  public bonusSpeedMult = 1;
  public canMove = true;
  // 「敵将を狙え」など命令の有効期限 (0 = 永続)
  public commandTimer = 0;

  // ターゲット
  public targetUnit: Unit | null = null;
  public targetGeneralRef: { hp: number; alive: boolean; pos: Vec2 } | null =
    null;

  public body: Phaser.GameObjects.Container;
  public sprite: Phaser.GameObjects.Rectangle;
  public soldierLabel: Phaser.GameObjects.Text;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFg: Phaser.GameObjects.Rectangle;
  private commandLabel: Phaser.GameObjects.Text;
  private selectionRing: Phaser.GameObjects.Arc;

  public constructor(
    scene: Phaser.Scene,
    type: UnitType,
    faction: Faction,
    lane: Lane,
    start: Vec2,
    options: { colorFaction?: Faction; flipText?: boolean } = {}
  ) {
    this.scene = scene;
    this.type = type;
    this.faction = faction;
    this.lane = lane;
    const stats = UNIT_STATS[type];
    this.hp = stats.hp;
    this.hpMax = stats.hp;
    this.soldiers = stats.soldiers;
    this.soldiersMax = stats.soldiers;
    const colorFaction = options.colorFaction ?? faction;
    const flip = options.flipText === true;

    const baseColor = colorFaction === "ally" ? 0x60a5fa : 0xf87171;
    const accent = colorForType(type);
    this.sprite = scene.add.rectangle(0, 0, 36, 36, baseColor, 1);
    this.sprite.setStrokeStyle(3, accent);

    const typeLetter = letterForType(type);
    const letter = scene.add
      .text(0, -2, typeLetter, {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    if (flip) letter.setRotation(Math.PI);

    this.soldierLabel = scene.add
      .text(0, 12, String(this.soldiers), {
        fontSize: "10px",
        color: "#fef3c7",
      })
      .setOrigin(0.5);
    if (flip) this.soldierLabel.setRotation(Math.PI);

    this.hpBarBg = scene.add
      .rectangle(0, -28, 44, 5, 0x000000, 0.6)
      .setStrokeStyle(1, 0xffffff, 0.5);
    this.hpBarFg = scene.add.rectangle(0, -28, 42, 3, 0x22c55e);

    this.commandLabel = scene.add
      .text(0, 24, "", {
        fontSize: "9px",
        color: "#fbbf24",
      })
      .setOrigin(0.5);
    if (flip) this.commandLabel.setRotation(Math.PI);

    this.selectionRing = scene.add.circle(0, 0, 30, 0, 0);
    this.selectionRing.setStrokeStyle(3, 0xfcd34d, 1);
    this.selectionRing.setVisible(false);

    this.body = scene.add.container(metersToPx(start.x), metersToPx(start.y), [
      this.selectionRing,
      this.sprite,
      letter,
      this.soldierLabel,
      this.hpBarBg,
      this.hpBarFg,
      this.commandLabel,
    ]);
    this.body.setDepth(40);
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

  public get soldierRatio(): number {
    return this.hp / this.hpMax;
  }

  public takeDamage(dmg: number): void {
    if (!this.alive) return;
    const real = dmg / this.bonusDefenseMult;
    const prevSoldiers = Math.ceil(this.soldiersMax * (this.hp / this.hpMax));
    this.hp = Math.max(0, this.hp - real);
    this.soldiers = Math.max(
      0,
      Math.ceil(this.soldiersMax * (this.hp / this.hpMax))
    );
    if (this.hp <= 0) {
      this.alive = false;
      this.soldiers = 0;
    }
    if (this.soldiers !== prevSoldiers) {
      this.soldierLabel.setText(String(this.soldiers));
    }
    this.updateHpBar();
  }

  public refreshVisibility(): void {
    this.body.setVisible(this.alive);
  }

  private updateHpBar(): void {
    const ratio = Math.max(0, this.hp / this.hpMax);
    this.hpBarFg.width = 42 * ratio;
    const color =
      ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    this.hpBarFg.fillColor = color;
    this.hpBarFg.x = -21 + (42 * ratio) / 2;
  }

  public setCommand(command: CommandType, timerSec = 0): void {
    this.command = command;
    this.commandTimer = timerSec;
    this.commandLabel.setText(commandLabelOf(command));
  }

  public setSelected(selected: boolean): void {
    this.selectionRing.setVisible(selected);
  }

  public resetForRespawn(spawn: Vec2): void {
    this.hp = this.hpMax;
    this.soldiers = this.soldiersMax;
    this.alive = true;
    this.soldierLabel.setText(String(this.soldiers));
    this.updateHpBar();
    this.setPosition(spawn);
    this.refreshVisibility();
  }
}

function colorForType(t: UnitType): number {
  switch (t) {
    case "infantry":
      return 0xffffff;
    case "spear":
      return 0xfde047;
    case "archer":
      return 0x86efac;
    case "cavalry":
      return 0xfca5a5;
  }
}

function letterForType(t: UnitType): string {
  switch (t) {
    case "infantry":
      return "歩";
    case "spear":
      return "槍";
    case "archer":
      return "弓";
    case "cavalry":
      return "馬";
  }
}

function commandLabelOf(c: CommandType): string {
  switch (c) {
    case "advance":
      return "前進";
    case "retreat":
      return "後退";
    case "defend":
      return "防衛";
    case "targetGeneral":
      return "敵将";
    case "rally":
      return "集結";
  }
}
