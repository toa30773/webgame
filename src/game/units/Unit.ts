import Phaser from "phaser";
import * as THREE from "three";
import type {
  CommandType,
  Faction,
  Lane,
  UnitType,
  Vec2,
} from "@/types/common";
import { UNIT_STATS } from "@/game/skills/balance";
import { PIXELS_PER_METER, metersToPx } from "@/game/map/mapConfig";
import { Soldier3D } from "@/game/render3d/Soldier3D";
import type { Renderer3D } from "@/game/render3d/Renderer3D";

interface FormationSlot {
  x: number;
  z: number;
}

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
  public commandTimer = 0;

  public targetUnit: Unit | null = null;
  public targetGeneralRef: { hp: number; alive: boolean; pos: Vec2 } | null =
    null;

  // Phaser コンテナはゲームロジック上の位置ホルダーとしてのみ使用 (描画は3D側)
  public body: Phaser.GameObjects.Container;

  private readonly renderer3D: Renderer3D;
  private readonly group3D: THREE.Group;
  private readonly soldiers3D: Soldier3D[] = [];
  private readonly formation: FormationSlot[];
  private readonly deathOrder: number[];
  private readonly hpBar3D: THREE.Sprite;
  private readonly selectionRing3D: THREE.Mesh;

  private readonly facingDir: number;

  private walkPhase = 0;
  private prevX = 0;
  private prevZ = 0;
  private lastDrawnSoldiers = -1;

  public constructor(
    scene: Phaser.Scene,
    type: UnitType,
    faction: Faction,
    lane: Lane,
    start: Vec2,
    options: {
      colorFaction?: Faction;
      flipText?: boolean;
      renderer3D: Renderer3D;
    }
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
    this.renderer3D = options.renderer3D;

    // ally = +Z 側 (画面下/手前) → 前方は -Z。enemy 逆。
    const baseFacing = colorFaction === "ally" ? -1 : 1;
    this.facingDir = flip ? -baseFacing : baseFacing;

    this.formation = buildFormation(type);
    this.deathOrder = buildDeathOrder(this.soldiersMax);

    // Phaser コンテナ (見えない、位置のみ)
    this.body = scene.add.container(metersToPx(start.x), metersToPx(start.y));
    this.body.setDepth(40);
    this.body.setVisible(false);
    this.prevX = start.x;
    this.prevZ = start.y;

    // 3D グループ
    this.group3D = new THREE.Group();
    this.group3D.position.set(start.x, 0, start.y);
    this.group3D.rotation.y = this.facingDir === -1 ? 0 : Math.PI;
    this.renderer3D.worldRoot.add(this.group3D);

    for (let i = 0; i < this.soldiersMax; i++) {
      const slot = this.formation[i];
      const s = new Soldier3D(type, colorFaction);
      s.group.position.set(slot.x, 0, slot.z);
      this.group3D.add(s.group);
      this.soldiers3D.push(s);
    }

    // HPバー (頭上のスプライト)
    this.hpBar3D = makeHpBarSprite();
    this.hpBar3D.position.set(0, 2.6, 0);
    this.group3D.add(this.hpBar3D);

    // 選択リング (地面の円リング)
    const ringGeom = new THREE.RingGeometry(1.4, 1.65, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.selectionRing3D = new THREE.Mesh(ringGeom, ringMat);
    this.selectionRing3D.rotation.x = -Math.PI / 2;
    this.selectionRing3D.position.set(0, 0.04, 0);
    this.selectionRing3D.visible = false;
    this.group3D.add(this.selectionRing3D);

    this.redrawAlive();
    this.updateHpBar();
  }

  public get position(): Vec2 {
    return {
      x: this.body.x / PIXELS_PER_METER,
      y: this.body.y / PIXELS_PER_METER,
    };
  }

  public setPosition(p: Vec2): void {
    this.body.setPosition(metersToPx(p.x), metersToPx(p.y));
    this.group3D.position.set(p.x, 0, p.y);
  }

  public get soldierRatio(): number {
    return this.hp / this.hpMax;
  }

  public takeDamage(dmg: number): void {
    if (!this.alive) return;
    const real = dmg / this.bonusDefenseMult;
    this.hp = Math.max(0, this.hp - real);
    this.soldiers = Math.max(
      0,
      Math.ceil(this.soldiersMax * (this.hp / this.hpMax))
    );
    if (this.hp <= 0) {
      this.alive = false;
      this.soldiers = 0;
    }
    this.updateHpBar();
    this.redrawAlive();
  }

  public refreshVisibility(): void {
    this.group3D.visible = this.alive;
  }

  public setCommand(command: CommandType, timerSec = 0): void {
    this.command = command;
    this.commandTimer = timerSec;
  }

  public setSelected(selected: boolean): void {
    this.selectionRing3D.visible = selected && this.alive;
  }

  public resetForRespawn(spawn: Vec2): void {
    this.hp = this.hpMax;
    this.soldiers = this.soldiersMax;
    this.alive = true;
    this.setPosition(spawn);
    this.refreshVisibility();
    this.redrawAlive();
    this.updateHpBar();
  }

  /** BattleScene の毎フレーム update から呼ぶ。位置同期＋歩行アニメ。 */
  public tick(deltaSec: number): void {
    if (!this.alive) {
      this.group3D.visible = false;
      return;
    }
    this.group3D.visible = true;

    // body (px) → 3D (m) へ位置同期
    const mx = this.body.x / PIXELS_PER_METER;
    const mz = this.body.y / PIXELS_PER_METER;
    this.group3D.position.x = mx;
    this.group3D.position.z = mz;

    const dx = mx - this.prevX;
    const dz = mz - this.prevZ;
    const moving = dx * dx + dz * dz > 0.0001;
    this.prevX = mx;
    this.prevZ = mz;

    // 向き: 進行方向にYaw補間
    if (moving) {
      const targetYaw = Math.atan2(dx, dz) + Math.PI; // -Z が前
      const cur = this.group3D.rotation.y;
      const diff = wrapAngle(targetYaw - cur);
      this.group3D.rotation.y = cur + diff * Math.min(1, deltaSec * 10);
      this.walkPhase = (this.walkPhase + deltaSec * 2.5) % 1;
    }

    for (const s of this.soldiers3D) s.animate(this.walkPhase, moving);
  }

  private updateHpBar(): void {
    const ratio = Math.max(0, this.hp / this.hpMax);
    drawHpBarTexture(this.hpBar3D, ratio);
  }

  private redrawAlive(): void {
    if (this.lastDrawnSoldiers === this.soldiers) return;
    this.lastDrawnSoldiers = this.soldiers;
    const deadCount = this.soldiersMax - this.soldiers;
    const deadSet = new Set<number>();
    for (let i = 0; i < deadCount; i++) deadSet.add(this.deathOrder[i]);
    for (let i = 0; i < this.soldiersMax; i++) {
      this.soldiers3D[i].setAlive(!deadSet.has(i));
    }
  }

  public dispose(): void {
    for (const s of this.soldiers3D) s.dispose();
    this.group3D.removeFromParent();
    this.body.destroy();
  }
}

function buildFormation(type: UnitType): FormationSlot[] {
  let rowSizes: number[];
  let spacingX: number;
  let spacingZ: number;
  switch (type) {
    case "infantry":
      rowSizes = [3, 4, 3];
      spacingX = 0.8;
      spacingZ = 0.85;
      break;
    case "spear":
      rowSizes = [4, 4];
      spacingX = 0.8;
      spacingZ = 0.85;
      break;
    case "archer":
      rowSizes = [4, 4];
      spacingX = 0.8;
      spacingZ = 0.85;
      break;
    case "cavalry":
      rowSizes = [5];
      spacingX = 1.2;
      spacingZ = 1.0;
      break;
  }
  const totalRows = rowSizes.length;
  const slots: FormationSlot[] = [];
  for (let r = 0; r < totalRows; r++) {
    const count = rowSizes[r];
    const z = ((totalRows - 1) / 2 - r) * spacingZ;
    for (let c = 0; c < count; c++) {
      const x = (c - (count - 1) / 2) * spacingX;
      slots.push({ x, z });
    }
  }
  return slots;
}

function buildDeathOrder(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let seed = n * 9301 + 49297;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 0x80000000;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeHpBarSprite(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 14;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.8, 0.26, 1);
  sprite.renderOrder = 1000;
  (sprite.userData as { canvas?: HTMLCanvasElement; tex?: THREE.CanvasTexture }).canvas =
    canvas;
  (sprite.userData as { canvas?: HTMLCanvasElement; tex?: THREE.CanvasTexture }).tex = tex;
  return sprite;
}

function drawHpBarTexture(sprite: THREE.Sprite, ratio: number): void {
  const ud = sprite.userData as {
    canvas?: HTMLCanvasElement;
    tex?: THREE.CanvasTexture;
  };
  const canvas = ud.canvas;
  const tex = ud.tex;
  if (!canvas || !tex) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, 0, w, h);
  const color =
    ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#f59e0b" : "#ef4444";
  ctx.fillStyle = color;
  ctx.fillRect(2, 2, (w - 4) * ratio, h - 4);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  tex.needsUpdate = true;
}
