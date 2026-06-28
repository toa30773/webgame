import * as THREE from "three";
import type { Faction, UnitType } from "@/types/common";

const SHARED = (() => {
  // 共有マテリアル (兵士1人分の draw call を抑える)
  const skin = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 });
  const helmet = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.4 });
  const allyBody = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8 });
  const enemyBody = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.8 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7c4a23, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.4, metalness: 0.7 });
  const shieldFace = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
  const horse = new THREE.MeshStandardMaterial({ color: 0x6b3a14, roughness: 0.95 });
  const bowString = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  return { skin, helmet, allyBody, enemyBody, leg, wood, steel, shieldFace, horse, bowString };
})();

// ジオメトリ共有
const G = (() => {
  const head = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const helmetCap = new THREE.BoxGeometry(0.32, 0.1, 0.32);
  const torso = new THREE.BoxGeometry(0.34, 0.42, 0.22);
  const limb = new THREE.BoxGeometry(0.1, 0.36, 0.1);
  const arm = new THREE.BoxGeometry(0.1, 0.34, 0.1);
  const spear = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6);
  const spearHead = new THREE.ConeGeometry(0.06, 0.16, 6);
  const sword = new THREE.BoxGeometry(0.06, 0.5, 0.02);
  const shield = new THREE.BoxGeometry(0.08, 0.35, 0.28);
  const bow = new THREE.TorusGeometry(0.22, 0.018, 6, 12, Math.PI * 1.4);
  const horseBody = new THREE.BoxGeometry(0.7, 0.35, 1.0);
  const horseNeck = new THREE.BoxGeometry(0.22, 0.3, 0.22);
  const horseLeg = new THREE.BoxGeometry(0.1, 0.45, 0.1);
  return { head, helmetCap, torso, limb, arm, spear, spearHead, sword, shield, bow, horseBody, horseNeck, horseLeg };
})();

/**
 * 低ポリ兵士。Box ジオメトリの組み合わせで構成。
 * - 歩行アニメ: 脚と腕を前後にスイング
 * - 死亡: alive=false にすると非表示
 */
export class Soldier3D {
  public readonly group: THREE.Group;
  public alive = true;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private corpse: THREE.Mesh;
  private aliveRig: THREE.Group;

  public constructor(type: UnitType, faction: Faction) {
    this.group = new THREE.Group();
    const bodyMat = faction === "ally" ? SHARED.allyBody : SHARED.enemyBody;
    const aliveRig = new THREE.Group();
    this.aliveRig = aliveRig;
    this.group.add(aliveRig);

    if (type === "cavalry") {
      this.buildHorse(aliveRig);
    }

    const yBase = type === "cavalry" ? 0.55 : 0;
    const ridingShift = type === "cavalry" ? 0.18 : 0;

    // 胴
    const torso = new THREE.Mesh(G.torso, bodyMat);
    torso.position.set(0, yBase + 0.65 + ridingShift, 0);
    torso.castShadow = true;
    aliveRig.add(torso);

    // 頭
    const head = new THREE.Mesh(G.head, SHARED.skin);
    head.position.set(0, yBase + 1.02 + ridingShift, 0);
    head.castShadow = true;
    aliveRig.add(head);

    // 兜
    const helmet = new THREE.Mesh(G.helmetCap, SHARED.helmet);
    helmet.position.set(0, yBase + 1.18 + ridingShift, 0);
    helmet.castShadow = true;
    aliveRig.add(helmet);

    // 腕 (兵種で持ち物が変わるので両腕の位置のみ作る)
    this.leftArm = new THREE.Mesh(G.arm, bodyMat);
    this.leftArm.position.set(-0.22, yBase + 0.65 + ridingShift, 0);
    this.leftArm.castShadow = true;
    aliveRig.add(this.leftArm);

    this.rightArm = new THREE.Mesh(G.arm, bodyMat);
    this.rightArm.position.set(0.22, yBase + 0.65 + ridingShift, 0);
    this.rightArm.castShadow = true;
    aliveRig.add(this.rightArm);

    // 脚 (騎馬は脚を見せない)
    this.leftLeg = new THREE.Mesh(G.limb, SHARED.leg);
    this.rightLeg = new THREE.Mesh(G.limb, SHARED.leg);
    if (type !== "cavalry") {
      this.leftLeg.position.set(-0.09, yBase + 0.25, 0);
      this.rightLeg.position.set(0.09, yBase + 0.25, 0);
      this.leftLeg.castShadow = true;
      this.rightLeg.castShadow = true;
      aliveRig.add(this.leftLeg);
      aliveRig.add(this.rightLeg);
    }

    this.attachWeapon(aliveRig, type, yBase + ridingShift);

    // 死体 (灰色の薄い箱) — 死亡時に表示
    const corpseMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 1,
    });
    const corpseGeom = new THREE.BoxGeometry(0.5, 0.08, 0.7);
    this.corpse = new THREE.Mesh(corpseGeom, corpseMat);
    this.corpse.position.set(0, 0.04, 0);
    this.corpse.castShadow = false;
    this.corpse.receiveShadow = true;
    this.corpse.visible = false;
    this.group.add(this.corpse);
  }

  private attachWeapon(rig: THREE.Group, type: UnitType, yBase: number): void {
    switch (type) {
      case "spear": {
        const shaft = new THREE.Mesh(G.spear, SHARED.wood);
        shaft.position.set(0.28, yBase + 0.85, 0.05);
        shaft.rotation.x = Math.PI / 12;
        shaft.castShadow = true;
        rig.add(shaft);
        const head = new THREE.Mesh(G.spearHead, SHARED.steel);
        head.position.set(0.28, yBase + 1.45, 0.18);
        head.rotation.x = Math.PI / 12;
        head.castShadow = true;
        rig.add(head);
        break;
      }
      case "archer": {
        const bow = new THREE.Mesh(G.bow, SHARED.wood);
        bow.position.set(0.34, yBase + 0.78, 0);
        bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
        bow.castShadow = true;
        rig.add(bow);
        break;
      }
      case "infantry": {
        // 盾 (左手) + 剣 (右手)
        const shield = new THREE.Mesh(G.shield, SHARED.shieldFace);
        shield.position.set(-0.34, yBase + 0.7, 0);
        shield.castShadow = true;
        rig.add(shield);
        const sword = new THREE.Mesh(G.sword, SHARED.steel);
        sword.position.set(0.32, yBase + 0.55, 0);
        sword.castShadow = true;
        rig.add(sword);
        break;
      }
      case "cavalry": {
        const shaft = new THREE.Mesh(G.spear, SHARED.wood);
        shaft.position.set(0.34, yBase + 0.85, 0.1);
        shaft.rotation.x = Math.PI / 10;
        shaft.castShadow = true;
        rig.add(shaft);
        const headM = new THREE.Mesh(G.spearHead, SHARED.steel);
        headM.position.set(0.34, yBase + 1.45, 0.28);
        headM.rotation.x = Math.PI / 10;
        headM.castShadow = true;
        rig.add(headM);
        break;
      }
    }
  }

  private buildHorse(rig: THREE.Group): void {
    const body = new THREE.Mesh(G.horseBody, SHARED.horse);
    body.position.set(0, 0.55, 0);
    body.castShadow = true;
    rig.add(body);

    const neck = new THREE.Mesh(G.horseNeck, SHARED.horse);
    neck.position.set(0, 0.78, -0.46);
    neck.rotation.x = -Math.PI / 7;
    neck.castShadow = true;
    rig.add(neck);

    const legPositions: [number, number][] = [
      [-0.28, 0.4],
      [0.28, 0.4],
      [-0.28, -0.4],
      [0.28, -0.4],
    ];
    for (const [x, z] of legPositions) {
      const leg = new THREE.Mesh(G.horseLeg, SHARED.horse);
      leg.position.set(x, 0.22, z);
      leg.castShadow = true;
      rig.add(leg);
    }
  }

  /** phase: 0..1 の振り、moving 時は脚と腕が反転スイング */
  public animate(phase: number, moving: boolean): void {
    if (!this.alive) return;
    const swing = moving ? Math.sin(phase * Math.PI * 2) * 0.55 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.6;
    this.rightArm.rotation.x = swing * 0.6;
  }

  public setAlive(alive: boolean): void {
    if (this.alive === alive) return;
    this.alive = alive;
    this.aliveRig.visible = alive;
    this.corpse.visible = !alive;
  }

  public dispose(): void {
    this.group.removeFromParent();
    // ジオメトリ・マテリアルは共有なので個別解放しない
  }
}
