import Phaser from "phaser";
import * as THREE from "three";
import type { Faction, Vec2 } from "@/types/common";
import { PIXELS_PER_METER, metersToPx } from "@/game/map/mapConfig";
import {
  GENERAL_CATALOG,
  type GeneralDef,
  type GeneralId,
} from "@/game/generals/generalsCatalog";
import { General3D } from "@/game/render3d/General3D";
import type { Renderer3D } from "@/game/render3d/Renderer3D";

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
  public facing: Vec2 = { x: 0, y: -1 };
  public attackSlowdownTimer = 0;
  public dodging = 0;
  public dodgeDir: Vec2 = { x: 0, y: 0 };
  public bonusAttackMult = 1;
  public bonusDefenseMult = 1;
  public bonusSpeedMult = 1;
  public canMove = true;
  public uniqueCooldown = 0;
  public uniqueActiveTime = 0;

  private readonly renderer3D: Renderer3D;
  private readonly model: General3D;
  private readonly group3D: THREE.Group;
  private readonly hpBar3D: THREE.Sprite;
  private readonly facingDir: number;

  private walkPhase = 0;
  private prevX = 0;
  private prevZ = 0;

  public constructor(
    scene: Phaser.Scene,
    faction: Faction,
    start: Vec2,
    options: {
      colorFaction?: Faction;
      flipText?: boolean;
      generalId?: GeneralId;
      renderer3D: Renderer3D;
    }
  ) {
    this.scene = scene;
    this.faction = faction;
    const def = GENERAL_CATALOG[options.generalId ?? "warrior"];
    this.def = def;
    this.hp = def.stats.hp;
    this.hpMax = def.stats.hp;
    const colorFaction = options.colorFaction ?? faction;
    const flip = options.flipText === true;
    this.renderer3D = options.renderer3D;

    const baseFacing = colorFaction === "ally" ? -1 : 1;
    this.facingDir = flip ? -baseFacing : baseFacing;

    // Phaser コンテナ (位置のみ、非表示)
    this.body = scene.add.container(metersToPx(start.x), metersToPx(start.y));
    this.body.setDepth(50);
    this.body.setVisible(false);

    // 3D モデル
    const accent = colorFaction === "ally" ? 0xfbbf24 : 0xfde047;
    this.model = new General3D(colorFaction, accent);
    this.group3D = new THREE.Group();
    this.group3D.position.set(start.x, 0, start.y);
    this.group3D.rotation.y = this.facingDir === -1 ? 0 : Math.PI;
    this.group3D.add(this.model.group);
    this.renderer3D.worldRoot.add(this.group3D);

    this.hpBar3D = makeHpBarSprite();
    this.hpBar3D.position.set(0, 3.4, 0);
    this.hpBar3D.scale.set(2.4, 0.32, 1);
    this.group3D.add(this.hpBar3D);

    this.prevX = start.x;
    this.prevZ = start.y;

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

  public takeDamage(dmg: number): void {
    if (!this.alive) return;
    const real = dmg / this.bonusDefenseMult;
    this.hp = Math.max(0, this.hp - real);
    if (this.hp <= 0) {
      this.alive = false;
      this.group3D.visible = false;
    }
    this.updateHpBar();
  }

  public tick(deltaSec: number): void {
    if (!this.alive) return;
    const mx = this.body.x / PIXELS_PER_METER;
    const mz = this.body.y / PIXELS_PER_METER;
    this.group3D.position.x = mx;
    this.group3D.position.z = mz;

    const dx = mx - this.prevX;
    const dz = mz - this.prevZ;
    const moving = dx * dx + dz * dz > 0.0001;
    this.prevX = mx;
    this.prevZ = mz;

    if (moving) {
      const targetYaw = Math.atan2(dx, dz) + Math.PI;
      const cur = this.group3D.rotation.y;
      const diff = wrapAngle(targetYaw - cur);
      this.group3D.rotation.y = cur + diff * Math.min(1, deltaSec * 10);
      this.walkPhase = (this.walkPhase + deltaSec * 2.0) % 1;
    }

    this.model.animate(this.walkPhase, moving);
  }

  private updateHpBar(): void {
    drawHpBarTexture(this.hpBar3D, Math.max(0, this.hp / this.hpMax));
  }

  public destroy(): void {
    this.model.dispose();
    this.group3D.removeFromParent();
    this.body.destroy();
  }
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeHpBarSprite(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 16;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 0.3, 1);
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
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, w, h);
  const color =
    ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#f59e0b" : "#ef4444";
  ctx.fillStyle = color;
  ctx.fillRect(2, 2, (w - 4) * ratio, h - 4);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  tex.needsUpdate = true;
}
