import * as THREE from "three";
import type { Faction } from "@/types/common";

/**
 * 低ポリ将軍。兵士より2倍のスケール、マント・羽根飾り・大型盾。
 */
export class General3D {
  public readonly group: THREE.Group;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private cape: THREE.Mesh;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  public constructor(faction: Faction, accentColor: number) {
    this.group = new THREE.Group();
    const bodyColor = faction === "ally" ? 0x1d4ed8 : 0xb91c1c;
    const bodyMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.2 })
    );
    const skinMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
    );
    const helmetMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.6 })
    );
    const accentMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 })
    );
    const capeMat = this.regMat(
      new THREE.MeshStandardMaterial({
        color: 0x7c2d12,
        roughness: 0.7,
        side: THREE.DoubleSide,
      })
    );
    const legMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.95 })
    );
    const shieldMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.4, metalness: 0.8 })
    );
    const swordMat = this.regMat(
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.9 })
    );

    const torsoGeom = this.regGeom(new THREE.BoxGeometry(0.62, 0.78, 0.4));
    const torso = new THREE.Mesh(torsoGeom, bodyMat);
    torso.position.set(0, 1.2, 0);
    torso.castShadow = true;
    this.group.add(torso);

    // 鎧の縦帯
    const stripeGeom = this.regGeom(new THREE.BoxGeometry(0.12, 0.8, 0.42));
    const stripe = new THREE.Mesh(stripeGeom, accentMat);
    stripe.position.set(0, 1.2, 0);
    this.group.add(stripe);

    const headGeom = this.regGeom(new THREE.BoxGeometry(0.42, 0.42, 0.42));
    const head = new THREE.Mesh(headGeom, skinMat);
    head.position.set(0, 1.85, 0);
    head.castShadow = true;
    this.group.add(head);

    const helmetGeom = this.regGeom(new THREE.BoxGeometry(0.5, 0.18, 0.5));
    const helmet = new THREE.Mesh(helmetGeom, helmetMat);
    helmet.position.set(0, 2.15, 0);
    helmet.castShadow = true;
    this.group.add(helmet);

    // 羽根飾り (前方に伸びる)
    const plumeGeom = this.regGeom(new THREE.ConeGeometry(0.1, 0.55, 6));
    const plume = new THREE.Mesh(plumeGeom, accentMat);
    plume.position.set(0, 2.4, 0.15);
    plume.rotation.x = Math.PI / 6;
    plume.castShadow = true;
    this.group.add(plume);

    // マント
    const capeGeom = this.regGeom(new THREE.PlaneGeometry(0.8, 1.1));
    this.cape = new THREE.Mesh(capeGeom, capeMat);
    this.cape.position.set(0, 1.2, -0.22);
    this.cape.rotation.x = -Math.PI / 18;
    this.cape.castShadow = true;
    this.group.add(this.cape);

    // 腕
    const armGeom = this.regGeom(new THREE.BoxGeometry(0.16, 0.6, 0.16));
    const leftArm = new THREE.Mesh(armGeom, bodyMat);
    leftArm.position.set(-0.4, 1.25, 0);
    leftArm.castShadow = true;
    this.group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, bodyMat);
    rightArm.position.set(0.4, 1.25, 0);
    rightArm.castShadow = true;
    this.group.add(rightArm);

    // 大型盾 (左手)
    const shieldGeom = this.regGeom(new THREE.BoxGeometry(0.12, 0.7, 0.45));
    const shield = new THREE.Mesh(shieldGeom, shieldMat);
    shield.position.set(-0.55, 1.2, 0);
    shield.castShadow = true;
    this.group.add(shield);
    const emblemGeom = this.regGeom(new THREE.CircleGeometry(0.1, 16));
    const emblem = new THREE.Mesh(emblemGeom, accentMat);
    emblem.position.set(-0.62, 1.25, 0.001);
    emblem.rotation.y = Math.PI / 2;
    this.group.add(emblem);

    // 剣
    const swordGeom = this.regGeom(new THREE.BoxGeometry(0.1, 0.95, 0.04));
    const sword = new THREE.Mesh(swordGeom, swordMat);
    sword.position.set(0.55, 1.0, 0.05);
    sword.rotation.z = -Math.PI / 12;
    sword.castShadow = true;
    this.group.add(sword);

    // 脚
    const legGeom = this.regGeom(new THREE.BoxGeometry(0.18, 0.7, 0.18));
    this.leftLeg = new THREE.Mesh(legGeom, legMat);
    this.leftLeg.position.set(-0.16, 0.45, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);
    this.rightLeg = new THREE.Mesh(legGeom, legMat);
    this.rightLeg.position.set(0.16, 0.45, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);
  }

  public animate(phase: number, moving: boolean): void {
    const swing = moving ? Math.sin(phase * Math.PI * 2) * 0.5 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    // マントが歩行で揺れる
    this.cape.rotation.z = swing * 0.06;
  }

  public dispose(): void {
    this.group.removeFromParent();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }

  private regMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private regGeom<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }
}
