import * as THREE from "three";
import {
  ALLY_BASE_Y,
  ENEMY_BASE_Y,
  LANE_X,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "@/game/map/mapConfig";

export interface PlacementZone {
  /** ワールド X 中央 */
  cx: number;
  /** ワールド Z 中央 */
  cz: number;
  /** 半幅 (X 方向) */
  halfX: number;
  /** 半幅 (Z 方向) */
  halfZ: number;
}

export const ALLY_PLACEMENT_ZONE: PlacementZone = {
  cx: MAP_WIDTH / 2,
  cz: ALLY_BASE_Y - 5,
  halfX: 9,
  halfZ: 4,
};

export const ENEMY_PLACEMENT_ZONE: PlacementZone = {
  cx: MAP_WIDTH / 2,
  cz: ENEMY_BASE_Y + 5,
  halfX: 9,
  halfZ: 4,
};

export function clampToZone(zone: PlacementZone, x: number, z: number): {
  x: number;
  z: number;
} {
  return {
    x: Math.max(zone.cx - zone.halfX, Math.min(zone.cx + zone.halfX, x)),
    z: Math.max(zone.cz - zone.halfZ, Math.min(zone.cz + zone.halfZ, z)),
  };
}

export function isInZone(zone: PlacementZone, x: number, z: number): boolean {
  return (
    x >= zone.cx - zone.halfX &&
    x <= zone.cx + zone.halfX &&
    z >= zone.cz - zone.halfZ &&
    z <= zone.cz + zone.halfZ
  );
}

/**
 * Three.js による戦場の描画レイヤー。
 * - Phaser キャンバスは入力 / ゲームロジックのみを担い、視覚はこちらが受け持つ。
 * - 座標系は仕様書のメートル単位をそのまま採用 (X = LANE 横方向, Z = 縦方向, Y = 高さ)。
 */
export class Renderer3D {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.OrthographicCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly worldRoot: THREE.Group;
  public readonly canvas: HTMLCanvasElement;

  private readonly flipView: boolean;
  private viewportWidth = 1;
  private viewportHeight = 1;

  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private placementOverlay: THREE.Group | null = null;
  private enemyFog: THREE.Mesh | null = null;

  public constructor(parent: HTMLElement, options: { flipView?: boolean } = {}) {
    this.flipView = options.flipView === true;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x10171f, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.zIndex = "0";
    this.canvas.style.pointerEvents = "none";
    parent.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.Fog(0x0b1220, 60, 130);

    // ライト
    const hemi = new THREE.HemisphereLight(0xfff7d6, 0x223344, 0.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(20, 40, 10);
    sun.target.position.set(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);
    this.scene.add(sun.target);

    // ワールドルート (回転や反転をここに掛ける)
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);

    this.buildGround();
    this.buildBases();

    // クラロワ風の俯瞰オルソカメラ
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const target = new THREE.Vector3(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
    const camDistance = 55;
    const tiltDeg = 38;
    const tiltRad = (tiltDeg * Math.PI) / 180;
    const dirY = this.flipView ? -1 : 1; // ゲストは反対側から見下ろす
    const offsetZ = Math.cos(tiltRad) * camDistance * dirY;
    const offsetY = Math.sin(tiltRad) * camDistance;
    this.camera.position.set(target.x, offsetY, target.z + offsetZ);
    this.camera.lookAt(target);
    if (this.flipView) {
      // ロールを揃えて画面の上下を維持
      this.camera.up.set(0, 1, 0);
    }
  }

  private buildGround(): void {
    // ベース地面
    const groundGeom = new THREE.PlaneGeometry(MAP_WIDTH + 8, MAP_HEIGHT + 12);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2f6b3d,
      roughness: 0.95,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
    ground.receiveShadow = true;
    this.worldRoot.add(ground);

    // レーン (薄く土色のストリップ)
    const laneMat = new THREE.MeshStandardMaterial({
      color: 0x8b6a3d,
      roughness: 1,
    });
    const laneWidth = 4;
    for (const lane of ["left", "center", "right"] as const) {
      const laneGeom = new THREE.PlaneGeometry(laneWidth, MAP_HEIGHT);
      const laneMesh = new THREE.Mesh(laneGeom, laneMat);
      laneMesh.rotation.x = -Math.PI / 2;
      laneMesh.position.set(LANE_X[lane], 0.01, MAP_HEIGHT / 2);
      laneMesh.receiveShadow = true;
      this.worldRoot.add(laneMesh);
    }

    // 中央ライン (川風)
    const riverGeom = new THREE.PlaneGeometry(MAP_WIDTH, 1.6);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x0b1d44,
    });
    const river = new THREE.Mesh(riverGeom, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(MAP_WIDTH / 2, 0.02, MAP_HEIGHT / 2);
    this.worldRoot.add(river);
  }

  private buildBases(): void {
    const buildBase = (z: number, color: number, label: string): void => {
      // 台座
      const baseGeom = new THREE.CylinderGeometry(4, 4.2, 1.2, 24);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        roughness: 0.7,
      });
      const base = new THREE.Mesh(baseGeom, baseMat);
      base.position.set(MAP_WIDTH / 2, 0.6, z);
      base.castShadow = true;
      base.receiveShadow = true;
      this.worldRoot.add(base);

      // 旗
      const poleGeom = new THREE.CylinderGeometry(0.08, 0.08, 4, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b2415 });
      const pole = new THREE.Mesh(poleGeom, poleMat);
      pole.position.set(MAP_WIDTH / 2, 3.2, z);
      pole.castShadow = true;
      this.worldRoot.add(pole);

      const flagGeom = new THREE.PlaneGeometry(2.4, 1.2);
      const flagMat = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
      });
      const flag = new THREE.Mesh(flagGeom, flagMat);
      flag.position.set(MAP_WIDTH / 2 + 1.2, 4.2, z);
      this.worldRoot.add(flag);
      // 旗を視認しやすく
      void label;
    };
    buildBase(ALLY_BASE_Y, 0x3b82f6, "ally");
    buildBase(ENEMY_BASE_Y, 0xef4444, "enemy");
  }

  public resize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.renderer.setSize(this.viewportWidth, this.viewportHeight, false);
    // マップ全体が収まるオルソフラスタム
    const aspect = this.viewportWidth / this.viewportHeight;
    const viewSizeY = MAP_HEIGHT * 0.62; // 縦方向にマップが収まる量 (傾きで縮む)
    const halfH = viewSizeY / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 配置フェーズ用に、自軍ゾーンをハイライトし、敵側を黒い霧で覆う。
   * ownZone は自軍配置エリア、enemySideZ は敵半分のZ中心。
   */
  public showPlacementOverlay(ownZone: PlacementZone, enemySideZ: number): void {
    this.hidePlacementOverlay();
    const group = new THREE.Group();

    // 自軍ゾーンの黄色ハイライト (床に薄く)
    const zoneGeom = new THREE.PlaneGeometry(ownZone.halfX * 2, ownZone.halfZ * 2);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const zone = new THREE.Mesh(zoneGeom, zoneMat);
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(ownZone.cx, 0.05, ownZone.cz);
    group.add(zone);

    // ゾーンの境界線 (リング状の四角)
    const edges = new THREE.EdgesGeometry(zoneGeom);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.85,
    });
    const border = new THREE.LineSegments(edges, lineMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(ownZone.cx, 0.07, ownZone.cz);
    group.add(border);

    // 敵半分を覆うフォグプレーン
    const fogGeom = new THREE.PlaneGeometry(MAP_WIDTH + 8, MAP_HEIGHT * 0.55);
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.enemyFog = new THREE.Mesh(fogGeom, fogMat);
    this.enemyFog.rotation.x = -Math.PI / 2;
    this.enemyFog.position.set(MAP_WIDTH / 2, 3.5, enemySideZ);
    group.add(this.enemyFog);

    // フォグに「？」マーク的な装飾 (旗付近に未知を示すテキスト)
    void this.flipView;

    this.placementOverlay = group;
    this.scene.add(group);
  }

  public hidePlacementOverlay(): void {
    if (!this.placementOverlay) return;
    this.scene.remove(this.placementOverlay);
    this.placementOverlay.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.placementOverlay = null;
    this.enemyFog = null;
  }

  /**
   * 画面ピクセル座標を地面 (Y=0) のワールド座標 (X, Z) に変換。
   */
  public screenToGround(sx: number, sy: number): { x: number; z: number } | null {
    const w = this.canvas.clientWidth || this.viewportWidth;
    const h = this.canvas.clientHeight || this.viewportHeight;
    const ndc = new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, out)) {
      return { x: out.x, z: out.z };
    }
    return null;
  }

  public dispose(): void {
    this.canvas.remove();
    this.renderer.dispose();
    // ジオメトリ/マテリアルを解放
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });
  }
}
