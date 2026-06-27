import Phaser from "phaser";
import {
  ALLY_BASE_Y,
  BASE_RADIUS,
  ENEMY_BASE_Y,
  LANE_SWITCH_Y_MAX,
  LANE_SWITCH_Y_MIN,
  LANE_X,
  MAP_HEIGHT,
  MAP_WIDTH,
  PIXELS_PER_METER,
  metersToPx,
} from "@/game/map/mapConfig";
import {
  GENERAL_AURA,
  MATCH_DURATION_SEC,
  MORALE,
  MORALE_SKILLS,
  RESPAWN_IN_BASE_SEC,
  RESPAWN_SEC,
  UNIT_STATS,
} from "@/game/skills/balance";
import {
  GENERAL_CATALOG,
  type GeneralId,
} from "@/game/generals/generalsCatalog";
import type {
  CommandType,
  Faction,
  Lane,
  MoraleSkillType,
  UnitType,
  Vec2,
} from "@/types/common";
import { General } from "@/game/generals/General";
import { Unit } from "@/game/units/Unit";
import { UnitAI, applyRallyMovement } from "@/game/ai/UnitAI";
import { EnemyGeneralAI } from "@/game/ai/EnemyGeneralAI";
import { MoraleSystem } from "@/game/morale/MoraleSystem";
import {
  computeGeneralVsGeneralDamage,
  computeGeneralVsUnitDamage,
  computeUnitVsGeneralDamage,
  computeUnitVsUnitDamage,
  isInAuraRange,
} from "@/game/battle/damage";
import { showDamageNumber } from "@/game/battle/damageNumbers";
import { useInputStore } from "@/store/inputStore";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { distance } from "@/utils/math";
import { Haptics } from "@/utils/haptics";
import { Sfx } from "@/services/sfx";
import { getActiveSession } from "@/services/matchmaking";
import type { NetMessage, BattleSnapshot } from "@/types/net";

interface RespawnTimer {
  unit: Unit;
  remaining: number;
  spawnPos: Vec2;
  lane: Lane;
}

export type SceneMode = "ai" | "host" | "guest";

export class BattleScene extends Phaser.Scene {
  private allyGeneral!: General;
  private enemyGeneral!: General;
  private allyUnits: Unit[] = [];
  private enemyUnits: Unit[] = [];
  private allyMorale = new MoraleSystem();
  private enemyMorale = new MoraleSystem();

  private matchTime = MATCH_DURATION_SEC;
  private lastInputAttackSeq = 0;
  private lastInputDodgeSeq = 0;
  private lastInputSkillSeq = 0;
  private lastCommandSeq = 0;
  private lastMoraleSkillSeq = 0;

  private respawns: RespawnTimer[] = [];
  private gameOver = false;

  // 敵AIタイマー (AIモードのみ使用)
  private enemyCmdCooldown = 0;
  private enemyMoraleCooldown = 4;

  // モード
  private mode: SceneMode = "ai";

  // ゲスト入力(remote) → host側で敵将操作に利用
  private remoteMove: { x: number; y: number } = { x: 0, y: 0 };
  private remoteAttackSeqSeen = 0;
  private remoteDodgeSeqSeen = 0;
  private remoteUniqueSeqSeen = 0;

  // 通信
  private snapshotInterval = 0.1; // 10Hz
  private snapshotTimer = 0;
  private inputSendInterval = 0.05; // 20Hz
  private inputSendTimer = 0;
  private lastSentMove = { x: 999, y: 999 };
  private netUnsubscribe: (() => void) | null = null;
  private opponentLeft = false;

  public constructor() {
    super({ key: "BattleScene" });
  }

  public create(): void {
    // セッションからモード決定 (spectatorは現状非対応 → aiにフォールバック)
    const battleMode = useSessionStore.getState().battleMode;
    this.mode = battleMode.kind === "spectator" ? "ai" : battleMode.kind;

    this.cameras.main.setBackgroundColor("#10171f");
    this.drawMap();

    const guestFlip = this.mode === "guest";
    const myGeneralId = useSessionStore.getState().myGeneral;
    // 敵将ID: AI モードはランダム、オンラインはとりあえず warrior (将来は相手の選択を受信)
    const enemyGeneralId: GeneralId =
      this.mode === "ai" ? pickRandomGeneral(myGeneralId) : "warrior";
    // host/AIモード: 自分=ally側を myGeneral / guestモード: 自分=enemy側を myGeneral
    const allyId: GeneralId = guestFlip ? enemyGeneralId : myGeneralId;
    const enemyId: GeneralId = guestFlip ? myGeneralId : enemyGeneralId;

    // ゲスト視点: 自分のキャラ=enemyGeneral を ally色(青) で描画
    this.allyGeneral = new General(
      this,
      "ally",
      { x: LANE_X.center, y: ALLY_BASE_Y - 1 },
      {
        colorFaction: guestFlip ? "enemy" : "ally",
        flipText: guestFlip,
        generalId: allyId,
      }
    );
    this.enemyGeneral = new General(
      this,
      "enemy",
      { x: LANE_X.center, y: ENEMY_BASE_Y + 1 },
      {
        colorFaction: guestFlip ? "ally" : "enemy",
        flipText: guestFlip,
        generalId: enemyId,
      }
    );

    this.spawnInitialUnits();

    // カメラ: クラロワ風にマップ全体が常に画面内に収まる
    this.cameras.main.setBounds(0, 0, metersToPx(MAP_WIDTH), metersToPx(MAP_HEIGHT));
    if (guestFlip) {
      this.cameras.main.setRotation(Math.PI);
    }
    this.fitCameraToMap();
    this.scale.on("resize", () => this.fitCameraToMap());

    // ストア初期化
    const myHp = (guestFlip ? this.enemyGeneral : this.allyGeneral).hpMax;
    const oppHp = (guestFlip ? this.allyGeneral : this.enemyGeneral).hpMax;
    useGameStore
      .getState()
      .reset(myHp, oppHp, MATCH_DURATION_SEC);
    this.syncHud();

    // ネット接続
    if (this.mode !== "ai") {
      this.attachNetSession();
    }

    // シーン破棄時の後片付け
    this.events.once("shutdown", () => {
      if (this.netUnsubscribe) {
        this.netUnsubscribe();
        this.netUnsubscribe = null;
      }
    });
  }

  /**
   * マップ全体が画面に収まるようにカメラのビューポートとズームを調整し、
   * 上下HUDを避けた中央エリアに描画する。画面サイズが変わるたびに呼び出す。
   */
  private fitCameraToMap(): void {
    const mapW = metersToPx(MAP_WIDTH);
    const mapH = metersToPx(MAP_HEIGHT);
    const screenW = Math.max(1, this.scale.width);
    const screenH = Math.max(1, this.scale.height);
    // 上下HUDの予約領域 (TopBar / 仮想スティック・アクションボタン)
    const topReserved = Math.min(screenH * 0.12, 80);
    const bottomReserved = Math.min(screenH * 0.28, 200);
    const availableH = Math.max(120, screenH - topReserved - bottomReserved);
    // カメラ自体を「使用可能エリア」の矩形に閉じ込める
    this.cameras.main.setViewport(0, topReserved, screenW, availableH);
    const zoom = Math.min((screenW * 0.98) / mapW, availableH / mapH);
    this.cameras.main.setZoom(zoom);
    // 回転(180°ゲスト視点)があっても centerOn はビューポート中央に世界の指定点を置く
    this.cameras.main.centerOn(mapW / 2, mapH / 2);
  }

  private attachNetSession(): void {
    const session = getActiveSession();
    if (!session) {
      useSessionStore.getState().setNetError("ネットセッションが見つかりません");
      return;
    }
    const offMsg = session.onMessage((msg) => this.handleNetMessage(msg));
    const offLeave = session.onOpponentLeave(() => {
      this.opponentLeft = true;
    });
    this.netUnsubscribe = (): void => {
      offMsg();
      offLeave();
    };
    // ready送信
    session.send({ type: "ready", from: this.mode === "host" ? "host" : "guest" });
  }

  private handleNetMessage(msg: NetMessage): void {
    if (msg.type === "snapshot" && this.mode === "guest") {
      this.applySnapshot(msg.payload);
      return;
    }
    if (this.mode === "host") {
      if (msg.type === "input" && msg.from === "guest") {
        this.remoteMove = { x: msg.moveX, y: msg.moveY };
      } else if (msg.type === "attack" && msg.from === "guest") {
        if (msg.seq !== this.remoteAttackSeqSeen) {
          this.remoteAttackSeqSeen = msg.seq;
          this.tryRemoteGeneralAttack();
        }
      } else if (msg.type === "dodge" && msg.from === "guest") {
        if (msg.seq !== this.remoteDodgeSeqSeen) {
          this.remoteDodgeSeqSeen = msg.seq;
          this.tryRemoteGeneralDodge();
        }
      } else if (msg.type === "uniqueSkill" && msg.from === "guest") {
        if (msg.seq !== this.remoteUniqueSeqSeen) {
          this.remoteUniqueSeqSeen = msg.seq;
          this.tryUniqueSkill(this.enemyGeneral, "enemy");
        }
      } else if (msg.type === "command" && msg.from === "guest") {
        const u = this.enemyUnits.find((x) => x.type === msg.unit);
        if (u) u.setCommand(msg.command);
      } else if (msg.type === "moraleSkill" && msg.from === "guest") {
        this.tryUseMoraleSkill(msg.skill, "enemy");
      } else if (msg.type === "ping" && msg.from === "guest") {
        const session = getActiveSession();
        session?.send({ type: "pong", from: "host", sentAt: msg.sentAt });
      } else if (msg.type === "leave") {
        this.opponentLeft = true;
      }
    } else if (this.mode === "guest") {
      if (msg.type === "pong" && msg.from === "host") {
        const ping = Date.now() - msg.sentAt;
        useSessionStore.getState().setPingMs(ping);
      } else if (msg.type === "leave") {
        this.opponentLeft = true;
      }
    }
  }

  private drawMap(): void {
    const W = metersToPx(MAP_WIDTH);
    const H = metersToPx(MAP_HEIGHT);
    // 背景
    const g = this.add.graphics();
    g.fillStyle(0x1f2937, 1);
    g.fillRect(0, 0, W, H);
    g.lineStyle(2, 0x334155, 1);
    g.strokeRect(0, 0, W, H);

    // レーン (左/中/右)
    const laneWidth = metersToPx(4.5);
    const laneColor = 0x223047;
    for (const lane of ["left", "center", "right"] as Lane[]) {
      g.fillStyle(laneColor, 1);
      g.fillRect(metersToPx(LANE_X[lane]) - laneWidth / 2, 0, laneWidth, H);
    }

    // レーン変更可能帯 (中央付近)
    g.fillStyle(0x2c3e58, 1);
    g.fillRect(
      0,
      metersToPx(LANE_SWITCH_Y_MIN),
      W,
      metersToPx(LANE_SWITCH_Y_MAX - LANE_SWITCH_Y_MIN)
    );

    const guestFlip = this.mode === "guest";
    // 本陣の色 (ゲスト視点では上下入れ替わるので色も入れ替える)
    const topColor = guestFlip ? 0x3b82f6 : 0xef4444;
    const topFill = guestFlip ? 0x172554 : 0x451a1a;
    const bottomColor = guestFlip ? 0xef4444 : 0x3b82f6;
    const bottomFill = guestFlip ? 0x451a1a : 0x172554;

    // 本陣 (上)
    g.lineStyle(3, topColor, 0.8);
    g.fillStyle(topFill, 1);
    g.fillCircle(metersToPx(LANE_X.center), metersToPx(ENEMY_BASE_Y), metersToPx(BASE_RADIUS));
    g.strokeCircle(metersToPx(LANE_X.center), metersToPx(ENEMY_BASE_Y), metersToPx(BASE_RADIUS));
    // 本陣 (下)
    g.lineStyle(3, bottomColor, 0.8);
    g.fillStyle(bottomFill, 1);
    g.fillCircle(metersToPx(LANE_X.center), metersToPx(ALLY_BASE_Y), metersToPx(BASE_RADIUS));
    g.strokeCircle(metersToPx(LANE_X.center), metersToPx(ALLY_BASE_Y), metersToPx(BASE_RADIUS));

    // ラベル (ゲストは入れ替え)
    const topLabel = guestFlip ? "自軍本陣" : "敵本陣";
    const bottomLabel = guestFlip ? "敵本陣" : "自軍本陣";
    const topTextColor = guestFlip ? "#bfdbfe" : "#fecaca";
    const bottomTextColor = guestFlip ? "#fecaca" : "#bfdbfe";

    const topText = this.add
      .text(metersToPx(LANE_X.center), metersToPx(ENEMY_BASE_Y), topLabel, {
        fontSize: "14px",
        color: topTextColor,
      })
      .setOrigin(0.5);
    const bottomText = this.add
      .text(metersToPx(LANE_X.center), metersToPx(ALLY_BASE_Y), bottomLabel, {
        fontSize: "14px",
        color: bottomTextColor,
      })
      .setOrigin(0.5);
    if (guestFlip) {
      topText.setRotation(Math.PI);
      bottomText.setRotation(Math.PI);
    }
  }

  private spawnInitialUnits(): void {
    // 各部隊の初期配置: レーンとレーン内オフセット(0=中央, -1/+1=サイド)
    const layout: Record<
      UnitType,
      { lane: Lane; offset: number; allyLane?: Lane }
    > = {
      infantry: { lane: "center", offset: -0.8 },
      spear: { lane: "center", offset: 0.8 },
      archer: { lane: "right", offset: 0 },
      cavalry: { lane: "left", offset: 0 },
    };
    // 敵側は左右ミラー
    const enemyLayout: Record<UnitType, { lane: Lane; offset: number }> = {
      infantry: { lane: "center", offset: 0.8 },
      spear: { lane: "center", offset: -0.8 },
      archer: { lane: "left", offset: 0 },
      cavalry: { lane: "right", offset: 0 },
    };
    const types: UnitType[] = ["infantry", "spear", "archer", "cavalry"];
    for (const t of types) {
      const a = layout[t];
      const e = enemyLayout[t];
      this.allyUnits.push(this.spawnUnit(t, "ally", a.lane, a.offset));
      this.enemyUnits.push(this.spawnUnit(t, "enemy", e.lane, e.offset));
    }
  }

  private spawnUnit(
    type: UnitType,
    faction: Faction,
    lane: Lane,
    laneOffset = 0
  ): Unit {
    const baseY = faction === "ally" ? ALLY_BASE_Y - 2 : ENEMY_BASE_Y + 2;
    const x = LANE_X[lane] + laneOffset;
    const guestFlip = this.mode === "guest";
    const colorFaction: Faction =
      guestFlip ? (faction === "ally" ? "enemy" : "ally") : faction;
    const unit = new Unit(this, type, faction, lane, { x, y: baseY }, {
      colorFaction,
      flipText: guestFlip,
    });
    unit.setCommand("advance");
    return unit;
  }

  public override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    if (this.gameOver) return;
    if (useGameStore.getState().paused && this.mode === "ai") {
      this.syncHud();
      return;
    }

    // ゲストモード: シミュレーションは行わず、入力送信のみ
    if (this.mode === "guest") {
      if (this.opponentLeft) {
        this.gameOver = true;
        useGameStore.getState().setStatus("victory");
        Sfx.victory();
        return;
      }
      this.processGuestInputs(dt);
      this.syncHudGuest();
      this.checkVictoryFromSnapshot();
      return;
    }

    // 相手切断 (ホスト視点) → 勝利確定
    if (this.opponentLeft && this.mode === "host") {
      this.gameOver = true;
      useGameStore.getState().setStatus("victory");
      Sfx.victory();
      return;
    }

    // 時間
    this.matchTime = Math.max(0, this.matchTime - dt);

    // 入力処理
    this.processInputs(dt);

    // 士気スキル効果反映
    this.applyMoraleEffects();

    // 固有スキル CD/active 減算
    this.allyGeneral.uniqueCooldown = Math.max(
      0,
      this.allyGeneral.uniqueCooldown - dt
    );
    this.allyGeneral.uniqueActiveTime = Math.max(
      0,
      this.allyGeneral.uniqueActiveTime - dt
    );
    this.enemyGeneral.uniqueCooldown = Math.max(
      0,
      this.enemyGeneral.uniqueCooldown - dt
    );
    this.enemyGeneral.uniqueActiveTime = Math.max(
      0,
      this.enemyGeneral.uniqueActiveTime - dt
    );
    // 固有スキル効果(持続)を反映
    this.applyUniqueEffects(this.allyGeneral, "ally");
    this.applyUniqueEffects(this.enemyGeneral, "enemy");

    // 将軍AI または リモート入力
    if (this.mode === "ai") {
      EnemyGeneralAI.update(this.enemyGeneral, this.allyGeneral, this.enemyUnits, dt, (dmg) => {
        this.damageGeneral(this.allyGeneral, this.enemyGeneral, dmg, this.enemyMorale);
      });
    } else {
      // host: 敵将はゲスト入力で移動
      this.updateRemoteGeneral(dt);
    }

    // 部隊AI更新
    for (const u of this.allyUnits) {
      UnitAI.update(u, dt, {
        allies: this.allyUnits,
        enemies: this.enemyUnits,
        allyGeneral: this.allyGeneral,
        enemyGeneral: this.enemyGeneral,
      });
    }
    for (const u of this.enemyUnits) {
      UnitAI.update(u, dt, {
        allies: this.enemyUnits,
        enemies: this.allyUnits,
        allyGeneral: this.enemyGeneral,
        enemyGeneral: this.allyGeneral,
      });
    }
    applyRallyMovement(this.allyUnits, this.allyGeneral, dt, "ally");
    applyRallyMovement(this.enemyUnits, this.enemyGeneral, dt, "enemy");

    // 戦闘解決
    this.resolveUnitAttacks(this.allyUnits, this.enemyUnits, this.allyGeneral, this.enemyGeneral, this.allyMorale, dt);
    this.resolveUnitAttacks(this.enemyUnits, this.allyUnits, this.enemyGeneral, this.allyGeneral, this.enemyMorale, dt);

    // 将軍同士の攻撃 (自将軍は手動、敵将軍はAIで対処済)
    // 自将軍の攻撃クールダウン
    this.allyGeneral.attackCooldown = Math.max(
      0,
      this.allyGeneral.attackCooldown - dt
    );
    this.allyGeneral.attackSlowdownTimer = Math.max(
      0,
      this.allyGeneral.attackSlowdownTimer - dt
    );
    this.allyGeneral.dodgeCooldown = Math.max(
      0,
      this.allyGeneral.dodgeCooldown - dt
    );
    if (this.allyGeneral.dodging > 0) {
      this.allyGeneral.dodging -= dt;
    }

    // 士気更新
    this.allyMorale.update(dt);
    this.enemyMorale.update(dt);

    // 敵AI: 命令送信・士気スキル (AIモードのみ)
    if (this.mode === "ai") {
      this.runEnemyMacroAI(dt);
    }

    // リスポーン処理
    this.processRespawns(dt);

    // ホスト: スナップショット送信
    if (this.mode === "host") {
      this.snapshotTimer += dt;
      if (this.snapshotTimer >= this.snapshotInterval) {
        this.snapshotTimer = 0;
        this.broadcastSnapshot();
      }
    }

    // HUD同期
    this.syncHud();

    // 勝敗判定
    this.checkVictory();
  }

  private processInputs(dt: number): void {
    const inp = useInputStore.getState();
    // 移動
    const slow = this.allyGeneral.attackSlowdownTimer > 0 ? 0.6 : 1.0;
    const speedMult = this.allyGeneral.bonusSpeedMult;
    if (this.allyGeneral.dodging > 0) {
      // 回避中: 高速直線移動 (12.0 m/s)
      const dx = this.allyGeneral.dodgeDir.x;
      const dy = this.allyGeneral.dodgeDir.y;
      const p = this.allyGeneral.position;
      const step = 12 * dt;
      this.allyGeneral.setPosition({
        x: clamp(p.x + dx * step, 0.5, MAP_WIDTH - 0.5),
        y: clamp(p.y + dy * step, 0.5, MAP_HEIGHT - 0.5),
      });
    } else if (
      this.allyGeneral.canMove &&
      Math.hypot(inp.moveX, inp.moveY) > 0.05
    ) {
      const len = Math.hypot(inp.moveX, inp.moveY);
      const ux = inp.moveX / len;
      const uy = inp.moveY / len;
      const p = this.allyGeneral.position;
      const step = this.allyGeneral.def.stats.speed * slow * speedMult * dt;
      this.allyGeneral.setPosition({
        x: clamp(p.x + ux * step, 0.5, MAP_WIDTH - 0.5),
        y: clamp(p.y + uy * step, 0.5, MAP_HEIGHT - 0.5),
      });
      this.allyGeneral.facing = { x: ux, y: uy };
    }

    // 攻撃
    if (inp.attackPressed !== this.lastInputAttackSeq) {
      this.lastInputAttackSeq = inp.attackPressed;
      this.tryAllyGeneralAttack();
    }
    // 回避
    if (inp.dodgePressed !== this.lastInputDodgeSeq) {
      this.lastInputDodgeSeq = inp.dodgePressed;
      this.tryAllyGeneralDodge();
    }
    // 固有スキル
    if (inp.skillPressed !== this.lastInputSkillSeq) {
      this.lastInputSkillSeq = inp.skillPressed;
      this.tryAllyUniqueSkill();
    }
    // 命令
    if (inp.commandSeq !== this.lastCommandSeq) {
      this.lastCommandSeq = inp.commandSeq;
      if (inp.commandUnit && inp.commandType) {
        this.applyCommand(inp.commandUnit, inp.commandType);
      }
    }
    // 士気スキル
    if (inp.moraleSkillSeq !== this.lastMoraleSkillSeq) {
      this.lastMoraleSkillSeq = inp.moraleSkillSeq;
      if (inp.moraleSkillType) {
        this.tryUseMoraleSkill(inp.moraleSkillType, "ally");
      }
    }
  }

  private tryAllyGeneralAttack(): void {
    if (!this.allyGeneral.alive) return;
    if (this.allyGeneral.attackCooldown > 0) return;
    const myStats = this.allyGeneral.def.stats;
    this.allyGeneral.attackCooldown = myStats.attackInterval;
    this.allyGeneral.attackSlowdownTimer = 0.3;

    // 近接範囲内の敵を1体攻撃 (優先: 敵将)
    const apos = this.allyGeneral.position;
    if (
      this.enemyGeneral.alive &&
      distance(apos, this.enemyGeneral.position) <= myStats.attackRange + 0.4
    ) {
      const dmg = computeGeneralVsGeneralDamage({
        baseAttack: myStats.attackDamage,
        attackerSkillMult: this.allyGeneral.bonusAttackMult,
        defenderSkillDefenseMult: 1.0,
      });
      this.damageGeneral(this.enemyGeneral, this.allyGeneral, dmg, this.allyMorale);
      return;
    }
    // 敵部隊
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const u of this.enemyUnits) {
      if (!u.alive) continue;
      const d = distance(apos, u.position);
      if (d <= myStats.attackRange + 0.4 && d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) {
      const dmg = computeGeneralVsUnitDamage({
        baseAttack: myStats.attackDamage,
        attackerSkillMult: this.allyGeneral.bonusAttackMult,
        defenderSkillDefenseMult: 1.0,
      });
      this.damageUnit(best, dmg, this.allyGeneral.position, this.allyMorale);
      Haptics.light();
      Sfx.attackHit();
    }
  }

  private tryAllyUniqueSkill(): void {
    this.tryUniqueSkill(this.allyGeneral, "ally");
  }

  /**
   * 将軍の固有スキル発動。faction側に効果適用。
   */
  private tryUniqueSkill(general: General, faction: Faction): void {
    if (!general.alive) return;
    if (general.uniqueCooldown > 0 || general.uniqueActiveTime > 0) return;
    const unique = general.def.unique;
    general.uniqueCooldown = unique.cooldown;

    switch (unique.id) {
      case "rallyAura": {
        // 周囲味方の攻撃+30% 6秒 → 自分にも適用
        general.uniqueActiveTime = unique.duration;
        break;
      }
      case "ironWall": {
        // 自分の防御+60% 5秒
        general.uniqueActiveTime = unique.duration;
        break;
      }
      case "shadowDash": {
        // 即時瞬間移動 8m
        const f = general.facing;
        let dx = f.x;
        let dy = f.y;
        const l = Math.hypot(dx, dy);
        if (l < 0.05) {
          dx = 0;
          dy = faction === "ally" ? -1 : 1;
        } else {
          dx /= l;
          dy /= l;
        }
        const dashDist = 8;
        const p = general.position;
        general.setPosition({
          x: clamp(p.x + dx * dashDist, 0.5, MAP_WIDTH - 0.5),
          y: clamp(p.y + dy * dashDist, 0.5, MAP_HEIGHT - 0.5),
        });
        general.uniqueActiveTime = 0;
        break;
      }
      case "battleCry": {
        // 4秒間、次の命令を全部隊に適用 (フラグ管理)
        general.uniqueActiveTime = unique.duration;
        break;
      }
    }
    Sfx.skill();
    Haptics.heavy();
  }

  /**
   * 固有スキルの持続効果を毎フレーム反映。
   */
  private applyUniqueEffects(general: General, faction: Faction): void {
    if (general.uniqueActiveTime <= 0) return;
    const id = general.def.unique.id;
    const units = faction === "ally" ? this.allyUnits : this.enemyUnits;
    if (id === "rallyAura") {
      const radius = 6 * general.def.auraRadiusMult;
      for (const u of units) {
        if (!u.alive) continue;
        if (distance(u.position, general.position) <= radius) {
          u.bonusAttackMult *= 1.3;
        }
      }
      general.bonusAttackMult *= 1.3;
    } else if (id === "ironWall") {
      general.bonusDefenseMult *= 1.6;
    } else if (id === "battleCry") {
      // 効果はコマンド適用時に判定
    }
  }

  private tryAllyGeneralDodge(): void {
    if (!this.allyGeneral.alive) return;
    if (this.allyGeneral.dodgeCooldown > 0) return;
    this.allyGeneral.dodgeCooldown = this.allyGeneral.def.stats.dodgeCooldown;
    this.allyGeneral.dodging = 0.25;
    const f = this.allyGeneral.facing;
    if (Math.hypot(f.x, f.y) < 0.05) {
      this.allyGeneral.dodgeDir = { x: 0, y: -1 };
    } else {
      const l = Math.hypot(f.x, f.y);
      this.allyGeneral.dodgeDir = { x: f.x / l, y: f.y / l };
    }
    Haptics.medium();
    Sfx.dodge();
  }

  private resolveUnitAttacks(
    attackers: Unit[],
    _defenders: Unit[],
    attackerGeneral: General,
    defenderGeneral: General,
    attackerMorale: MoraleSystem,
    dt: number
  ): void {
    for (const u of attackers) {
      if (!u.alive) continue;
      u.attackCooldown = Math.max(0, u.attackCooldown - dt);
      const stats = UNIT_STATS[u.type];
      if (u.attackCooldown > 0) continue;
      // 攻撃対象
      let dmg = 0;
      const auraBonus = isInAuraRange(distance(u.position, attackerGeneral.position))
        ? GENERAL_AURA.attackBonus
        : 0;
      if (u.targetGeneralRef && defenderGeneral.alive) {
        const d = distance(u.position, defenderGeneral.position);
        if (d <= stats.range + 0.2) {
          u.attackCooldown = stats.attackInterval;
          dmg = computeUnitVsGeneralDamage({
            attackerType: u.type,
            attackerBaseAttack: stats.attack,
            attackerSoldierRatio: Math.max(0.05, u.soldierRatio),
            attackerSkillMult: u.bonusAttackMult,
            attackerAuraBonusAttack: auraBonus,
            generalDefenseMult: 1.0,
          });
          this.damageGeneral(defenderGeneral, attackerGeneral, dmg, attackerMorale);
        }
      } else if (u.targetUnit && u.targetUnit.alive) {
        const d = distance(u.position, u.targetUnit.position);
        if (d <= stats.range + 0.2) {
          u.attackCooldown = stats.attackInterval;
          dmg = computeUnitVsUnitDamage({
            attackerType: u.type,
            attackerBaseAttack: stats.attack,
            attackerSoldierRatio: Math.max(0.05, u.soldierRatio),
            attackerSkillMult: u.bonusAttackMult,
            attackerAuraBonusAttack: auraBonus,
            defenderType: u.targetUnit.type,
            defenderSkillDefenseMult: 1.0,
          });
          const target = u.targetUnit;
          const wasAlive = target.alive;
          const before = target.soldiers;
          this.damageUnit(target, dmg, u.position, attackerMorale, /*favorable*/ matchupFavor(u.type, target.type));
          const killedSoldiers = before - target.soldiers;
          if (killedSoldiers > 0) attackerMorale.onKillSoldier(killedSoldiers);
          if (wasAlive && !target.alive) attackerMorale.onKillSquad();
          if (!target.alive) {
            this.enqueueRespawn(target, defenderGeneral);
          }
        }
      }
      // 攻撃対象がいない: クールダウンは進めない
    }
    void defenderGeneral;
  }

  private damageUnit(
    target: Unit,
    dmg: number,
    fromPos: Vec2,
    _attackerMorale: MoraleSystem,
    favorable = false
  ): void {
    target.takeDamage(dmg);
    showDamageNumber(
      this,
      metersToPx((fromPos.x + target.position.x) / 2),
      metersToPx(target.position.y),
      dmg,
      favorable ? "favorable" : "normal"
    );
  }

  private damageGeneral(
    target: General,
    _attacker: General,
    dmg: number,
    attackerMorale: MoraleSystem
  ): void {
    target.takeDamage(dmg);
    showDamageNumber(
      this,
      metersToPx(target.position.x),
      metersToPx(target.position.y),
      dmg,
      "critical"
    );
    attackerMorale.onDamageEnemyGeneral(dmg);
    if (target === this.allyGeneral) {
      Haptics.hit();
      Sfx.generalDamage();
    } else if (target === this.enemyGeneral) {
      Haptics.medium();
      Sfx.generalAttackHit();
    }
  }

  private enqueueRespawn(unit: Unit, _enemyGeneral: General): void {
    unit.refreshVisibility();
    const baseY = unit.faction === "ally" ? ALLY_BASE_Y - 2 : ENEMY_BASE_Y + 2;
    // 本陣範囲内で倒れていれば短いリスポーン
    const inBase = distance(unit.position, {
      x: LANE_X.center,
      y: unit.faction === "ally" ? ALLY_BASE_Y : ENEMY_BASE_Y,
    }) <= BASE_RADIUS;
    const sec = inBase ? RESPAWN_IN_BASE_SEC : RESPAWN_SEC;
    const spawnPos: Vec2 = { x: LANE_X[unit.lane], y: baseY };
    this.respawns.push({ unit, remaining: sec, spawnPos, lane: unit.lane });
  }

  private processRespawns(dt: number): void {
    if (this.respawns.length === 0) return;
    for (const r of this.respawns) r.remaining -= dt;
    const done = this.respawns.filter((r) => r.remaining <= 0);
    if (done.length === 0) return;
    for (const r of done) {
      r.unit.resetForRespawn(r.spawnPos);
      // 復活後は最後の命令を引き継ぐ
    }
    this.respawns = this.respawns.filter((r) => r.remaining > 0);
  }

  private applyCommand(unit: UnitType, cmd: CommandType): void {
    // 智将「総号令」: アクティブ中の最初の1命令だけ全部隊に一斉適用
    const battleCryActive =
      this.allyGeneral.def.unique.id === "battleCry" &&
      this.allyGeneral.uniqueActiveTime > 0;
    if (battleCryActive) {
      for (const u of this.allyUnits) {
        u.setCommand(cmd);
      }
      // 1度使ったら効果終了
      this.allyGeneral.uniqueActiveTime = 0;
      return;
    }
    const u = this.allyUnits.find((x) => x.type === unit);
    if (!u) return;
    u.setCommand(cmd);
  }

  private applyMoraleEffects(): void {
    // ally
    this.applyMoraleEffectsFor(this.allyMorale, this.allyUnits, this.allyGeneral);
    this.applyMoraleEffectsFor(this.enemyMorale, this.enemyUnits, this.enemyGeneral);
  }

  private applyMoraleEffectsFor(m: MoraleSystem, units: Unit[], general: General): void {
    const active = m.currentActiveSkill;
    // 既定リセット
    for (const u of units) {
      u.bonusAttackMult = 1;
      u.bonusDefenseMult = 1;
      u.bonusSpeedMult = 1;
      u.canMove = true;
    }
    general.bonusAttackMult = 1;
    general.bonusDefenseMult = 1;
    general.bonusSpeedMult = 1;
    general.canMove = true;
    if (active === "charge") {
      for (const u of units) {
        u.bonusAttackMult = 1.2;
        u.bonusSpeedMult = 1.3;
      }
      // 将軍にも反映
      general.bonusAttackMult = 1.2;
      general.bonusSpeedMult = 1.3;
    } else if (active === "defenseFormation") {
      for (const u of units) {
        u.bonusDefenseMult = 1.3;
        u.canMove = false;
      }
      general.bonusDefenseMult = 1.3;
      general.canMove = false;
    } else if (active === "inspire") {
      // 将軍周囲のみ
      for (const u of units) {
        if (distance(u.position, general.position) <= GENERAL_AURA.radius) {
          u.bonusAttackMult = 1.2;
          u.bonusDefenseMult = 1.2;
        }
      }
      general.bonusAttackMult = 1.2;
      general.bonusDefenseMult = 1.2;
    } else if (active === "totalAttack") {
      // 全軍が敵将を優先 (commandを上書き)
      for (const u of units) {
        if (u.command !== "targetGeneral") {
          u.setCommand("targetGeneral", m.currentActiveSkillTime);
        }
      }
    }
  }

  private tryUseMoraleSkill(skill: MoraleSkillType, faction: Faction): void {
    const morale = faction === "ally" ? this.allyMorale : this.enemyMorale;
    const units = faction === "ally" ? this.allyUnits : this.enemyUnits;
    const general = faction === "ally" ? this.allyGeneral : this.enemyGeneral;
    if (!morale.canUse(skill)) return;
    const ok = morale.use(skill);
    if (!ok) return;
    if (skill === "rally") {
      for (const u of units) u.setCommand("rally");
    } else if (skill === "totalAttack") {
      for (const u of units) u.setCommand("targetGeneral", MORALE_SKILLS.totalAttack.duration);
    }
    if (faction === "ally") Sfx.skill();
    void general;
  }

  // -------- ホスト: ゲスト入力で敵将操作 --------
  private updateRemoteGeneral(dt: number): void {
    const g = this.enemyGeneral;
    if (!g.alive) return;
    g.attackCooldown = Math.max(0, g.attackCooldown - dt);
    g.attackSlowdownTimer = Math.max(0, g.attackSlowdownTimer - dt);
    g.dodgeCooldown = Math.max(0, g.dodgeCooldown - dt);
    if (g.dodging > 0) {
      g.dodging -= dt;
      const step = 12 * dt;
      const p = g.position;
      g.setPosition({
        x: clamp(p.x + g.dodgeDir.x * step, 0.5, MAP_WIDTH - 0.5),
        y: clamp(p.y + g.dodgeDir.y * step, 0.5, MAP_HEIGHT - 0.5),
      });
      return;
    }
    if (!g.canMove) return;
    // ゲストの入力(自視点)はホスト世界では上下左右反転(ゲストの「前進」=自陣に向かう)
    // ゲスト視点では自将が画面下なので moveY<0 で「前進」(敵陣 = ホストの allyBase 方向)
    // ホストの enemyGeneral は画面上に居るので moveY<0 (上向き) = 後退 すべきだが、
    // ゲストの入力はゲスト視点の方向ベクトル。これをホスト世界に反映するときは符号反転。
    const mx = -this.remoteMove.x;
    const my = -this.remoteMove.y;
    const len = Math.hypot(mx, my);
    if (len < 0.05) return;
    const slow = g.attackSlowdownTimer > 0 ? 0.6 : 1.0;
    const speed = g.def.stats.speed * slow * g.bonusSpeedMult;
    const ux = mx / len;
    const uy = my / len;
    const p = g.position;
    const step = speed * dt;
    g.setPosition({
      x: clamp(p.x + ux * step, 0.5, MAP_WIDTH - 0.5),
      y: clamp(p.y + uy * step, 0.5, MAP_HEIGHT - 0.5),
    });
    g.facing = { x: ux, y: uy };
  }

  private tryRemoteGeneralAttack(): void {
    const g = this.enemyGeneral;
    if (!g.alive || g.attackCooldown > 0) return;
    const stats = g.def.stats;
    g.attackCooldown = stats.attackInterval;
    g.attackSlowdownTimer = 0.3;
    const pos = g.position;
    // 自将優先
    if (
      this.allyGeneral.alive &&
      distance(pos, this.allyGeneral.position) <= stats.attackRange + 0.4
    ) {
      const dmg = stats.attackDamage * g.bonusAttackMult;
      this.damageGeneral(this.allyGeneral, g, dmg, this.enemyMorale);
      return;
    }
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const u of this.allyUnits) {
      if (!u.alive) continue;
      const d = distance(pos, u.position);
      if (d <= stats.attackRange + 0.4 && d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) {
      const dmg = stats.attackDamage * g.bonusAttackMult;
      this.damageUnit(best, dmg, pos, this.enemyMorale);
    }
  }

  private tryRemoteGeneralDodge(): void {
    const g = this.enemyGeneral;
    if (!g.alive || g.dodgeCooldown > 0) return;
    g.dodgeCooldown = g.def.stats.dodgeCooldown;
    g.dodging = 0.25;
    const f = g.facing;
    if (Math.hypot(f.x, f.y) < 0.05) {
      g.dodgeDir = { x: 0, y: 1 }; // ゲスト視点で前方=下
    } else {
      const l = Math.hypot(f.x, f.y);
      g.dodgeDir = { x: f.x / l, y: f.y / l };
    }
  }

  // -------- ゲスト: 入力送信 + スナップショット適用 --------
  private processGuestInputs(dt: number): void {
    const inp = useInputStore.getState();
    const session = getActiveSession();
    if (!session) return;
    this.inputSendTimer += dt;
    if (this.inputSendTimer >= this.inputSendInterval) {
      this.inputSendTimer = 0;
      const dx = inp.moveX;
      const dy = inp.moveY;
      if (
        Math.abs(dx - this.lastSentMove.x) > 0.05 ||
        Math.abs(dy - this.lastSentMove.y) > 0.05
      ) {
        this.lastSentMove = { x: dx, y: dy };
        session.send({ type: "input", from: "guest", moveX: dx, moveY: dy });
      }
    }
    if (inp.attackPressed !== this.lastInputAttackSeq) {
      this.lastInputAttackSeq = inp.attackPressed;
      session.send({ type: "attack", from: "guest", seq: inp.attackPressed });
    }
    if (inp.dodgePressed !== this.lastInputDodgeSeq) {
      this.lastInputDodgeSeq = inp.dodgePressed;
      session.send({ type: "dodge", from: "guest", seq: inp.dodgePressed });
    }
    if (inp.skillPressed !== this.lastInputSkillSeq) {
      this.lastInputSkillSeq = inp.skillPressed;
      session.send({
        type: "uniqueSkill",
        from: "guest",
        seq: inp.skillPressed,
      });
    }
    if (inp.commandSeq !== this.lastCommandSeq) {
      this.lastCommandSeq = inp.commandSeq;
      if (inp.commandUnit && inp.commandType) {
        session.send({
          type: "command",
          from: "guest",
          unit: inp.commandUnit,
          command: inp.commandType,
        });
      }
    }
    if (inp.moraleSkillSeq !== this.lastMoraleSkillSeq) {
      this.lastMoraleSkillSeq = inp.moraleSkillSeq;
      if (inp.moraleSkillType) {
        session.send({
          type: "moraleSkill",
          from: "guest",
          skill: inp.moraleSkillType,
        });
      }
    }
    // Ping
    if (Math.random() < 0.02) {
      session.send({ type: "ping", from: "guest", sentAt: Date.now() });
    }
  }

  private applySnapshot(s: BattleSnapshot): void {
    // 将軍
    for (const g of s.generals) {
      const target = g.faction === "ally" ? this.allyGeneral : this.enemyGeneral;
      const prevHp = target.hp;
      target.setPosition(g.pos);
      target.alive = g.alive;
      target.dodgeCooldown = g.dodgeCd;
      target.uniqueCooldown = g.uniqueCd;
      target.uniqueActiveTime = g.uniqueActive;
      // HP変化があればダメージ数字を表示
      if (prevHp > g.hp + 0.5) {
        showDamageNumber(
          this,
          metersToPx(g.pos.x),
          metersToPx(g.pos.y),
          prevHp - g.hp,
          "critical",
          /*flipText=*/ true
        );
      }
      target.hp = g.hp;
    }
    // 部隊: type+factionで対応付け
    for (const u of s.units) {
      const list = u.faction === "ally" ? this.allyUnits : this.enemyUnits;
      const ent = list.find((x) => x.type === u.type);
      if (!ent) continue;
      const prevHp = ent.hp;
      ent.setPosition(u.pos);
      ent.hp = u.hp;
      ent.soldiers = u.soldiers;
      ent.alive = u.alive;
      ent.setCommand(u.command);
      ent.refreshVisibility();
      if (prevHp > u.hp + 0.5) {
        showDamageNumber(
          this,
          metersToPx(u.pos.x),
          metersToPx(u.pos.y),
          prevHp - u.hp,
          "normal",
          /*flipText=*/ true
        );
      }
    }
    this.matchTime = s.matchTimeLeft;
    if (s.status !== "playing") {
      this.gameOver = true;
      // ゲストの視点に翻訳: ホストが勝利ならゲストは敗北
      const guestStatus = s.status === "victory" ? "defeat" : "victory";
      useGameStore.getState().setStatus(guestStatus);
      if (guestStatus === "victory") Sfx.victory();
      else Sfx.defeat();
    }
  }

  private broadcastSnapshot(): void {
    const session = getActiveSession();
    if (!session) return;
    const snapshot: BattleSnapshot = {
      t: Date.now() / 1000,
      matchTimeLeft: this.matchTime,
      status: useGameStore.getState().status,
      generals: [
        {
          faction: "ally",
          alive: this.allyGeneral.alive,
          pos: this.allyGeneral.position,
          hp: this.allyGeneral.hp,
          dodgeCd: this.allyGeneral.dodgeCooldown,
          dodgeCdMax: this.allyGeneral.def.stats.dodgeCooldown,
          uniqueCd: this.allyGeneral.uniqueCooldown,
          uniqueCdMax: this.allyGeneral.def.unique.cooldown,
          uniqueActive: this.allyGeneral.uniqueActiveTime,
        },
        {
          faction: "enemy",
          alive: this.enemyGeneral.alive,
          pos: this.enemyGeneral.position,
          hp: this.enemyGeneral.hp,
          dodgeCd: this.enemyGeneral.dodgeCooldown,
          dodgeCdMax: this.enemyGeneral.def.stats.dodgeCooldown,
          uniqueCd: this.enemyGeneral.uniqueCooldown,
          uniqueCdMax: this.enemyGeneral.def.unique.cooldown,
          uniqueActive: this.enemyGeneral.uniqueActiveTime,
        },
      ],
      units: [
        ...this.allyUnits.map((u) => ({
          type: u.type,
          faction: "ally" as const,
          alive: u.alive,
          pos: u.position,
          hp: u.hp,
          soldiers: u.soldiers,
          command: u.command,
          respawnIn:
            this.respawns.find((r) => r.unit === u)?.remaining ?? 0,
        })),
        ...this.enemyUnits.map((u) => ({
          type: u.type,
          faction: "enemy" as const,
          alive: u.alive,
          pos: u.position,
          hp: u.hp,
          soldiers: u.soldiers,
          command: u.command,
          respawnIn:
            this.respawns.find((r) => r.unit === u)?.remaining ?? 0,
        })),
      ],
      hostMorale: this.allyMorale.current,
      guestMorale: this.enemyMorale.current,
      hostActiveSkill: this.allyMorale.currentActiveSkill,
      hostActiveSkillTime: this.allyMorale.currentActiveSkillTime,
      guestActiveSkill: this.enemyMorale.currentActiveSkill,
      guestActiveSkillTime: this.enemyMorale.currentActiveSkillTime,
    };
    session.send({ type: "snapshot", payload: snapshot });
  }

  private syncHudGuest(): void {
    // ゲスト視点: 自分のキャラ = enemyGeneral
    const store = useGameStore.getState();
    store.setAllyGeneralHp(this.enemyGeneral.hp);
    store.setEnemyGeneralHp(this.allyGeneral.hp);
    store.setMorale(this.enemyMorale.current);
    store.setMatchTimeLeft(this.matchTime);
    store.setDodgeCooldown(this.enemyGeneral.dodgeCooldown);
    store.setActiveSkill(
      this.enemyMorale.currentActiveSkill,
      this.enemyMorale.currentActiveSkillTime
    );
    store.setUniqueState(
      this.enemyGeneral.uniqueCooldown,
      this.enemyGeneral.def.unique.cooldown,
      this.enemyGeneral.uniqueActiveTime
    );
    const selected = store.selectedUnit;
    // ゲストの「自分の部隊」=enemyUnits
    for (const u of this.enemyUnits) {
      store.setUnit(u.type, {
        hp: u.hp,
        hpMax: u.hpMax,
        soldiers: u.soldiers,
        soldiersMax: u.soldiersMax,
        alive: u.alive,
        respawnIn: 0,
        command: u.command,
      });
      u.setSelected(selected === u.type && u.alive);
    }
  }

  private checkVictoryFromSnapshot(): void {
    // gameStore.status を見て遷移する。BattlePageが result 画面遷移する。
  }

  private runEnemyMacroAI(dt: number): void {
    this.enemyCmdCooldown -= dt;
    this.enemyMoraleCooldown -= dt;
    const myRatio = this.enemyGeneral.hp / this.enemyGeneral.hpMax;
    const targetRatio = this.allyGeneral.hp / this.allyGeneral.hpMax;
    if (this.enemyCmdCooldown <= 0) {
      this.enemyCmdCooldown = 5 + Math.random() * 3;
      if (myRatio < 0.3) {
        // 危険: 集結→防衛
        for (const u of this.enemyUnits) u.setCommand("rally");
      } else if (targetRatio < 0.35) {
        // 敵が弱い: 一気に敵将を狙う
        for (const u of this.enemyUnits) u.setCommand("targetGeneral");
      } else if (Math.random() < 0.25) {
        // 時々狙わせる
        for (const u of this.enemyUnits) u.setCommand("targetGeneral");
      } else {
        for (const u of this.enemyUnits) u.setCommand("advance");
      }
    }
    if (this.enemyMoraleCooldown <= 0) {
      this.enemyMoraleCooldown = 3;
      // 状況に応じて士気スキルを選択
      const candidate = this.pickEnemyMoraleSkill(myRatio, targetRatio);
      if (candidate) {
        this.tryUseMoraleSkill(candidate, "enemy");
      }
    }
  }

  private pickEnemyMoraleSkill(
    myRatio: number,
    targetRatio: number
  ): MoraleSkillType | null {
    const m = this.enemyMorale;
    // 敵が瀕死なら総攻撃で押し切る
    if (targetRatio < 0.35 && m.canUse("totalAttack")) return "totalAttack";
    // 自分が瀕死なら防御陣形
    if (myRatio < 0.3 && m.canUse("defenseFormation")) return "defenseFormation";
    // 将軍近くに味方が居なくなったら集結
    const nearby = this.enemyUnits.filter(
      (u) => u.alive && distance(u.position, this.enemyGeneral.position) < 6
    ).length;
    if (nearby <= 1 && m.canUse("rally")) return "rally";
    // 接近戦中なら鼓舞
    const inAuraEngaged = this.enemyUnits.some(
      (u) =>
        u.alive &&
        distance(u.position, this.enemyGeneral.position) < 6 &&
        u.targetUnit &&
        u.targetUnit.alive
    );
    if (inAuraEngaged && m.canUse("inspire")) return "inspire";
    // それ以外で前進中なら突撃
    if (m.canUse("charge")) return "charge";
    return null;
  }

  private syncHud(): void {
    const store = useGameStore.getState();
    store.setAllyGeneralHp(this.allyGeneral.hp);
    store.setEnemyGeneralHp(this.enemyGeneral.hp);
    store.setMorale(this.allyMorale.current);
    store.setMatchTimeLeft(this.matchTime);
    store.setDodgeCooldown(this.allyGeneral.dodgeCooldown);
    store.setActiveSkill(
      this.allyMorale.currentActiveSkill,
      this.allyMorale.currentActiveSkillTime
    );
    store.setUniqueState(
      this.allyGeneral.uniqueCooldown,
      this.allyGeneral.def.unique.cooldown,
      this.allyGeneral.uniqueActiveTime
    );
    const selected = store.selectedUnit;
    for (const u of this.allyUnits) {
      const respawnEntry = this.respawns.find((r) => r.unit === u);
      store.setUnit(u.type, {
        hp: u.hp,
        hpMax: u.hpMax,
        soldiers: u.soldiers,
        soldiersMax: u.soldiersMax,
        alive: u.alive,
        respawnIn: respawnEntry?.remaining ?? 0,
        command: u.command,
      });
      u.setSelected(selected === u.type && u.alive);
    }
  }

  private checkVictory(): void {
    if (this.gameOver) return;
    if (!this.allyGeneral.alive) {
      this.gameOver = true;
      useGameStore.getState().setStatus("defeat");
      Sfx.defeat();
      return;
    }
    if (!this.enemyGeneral.alive) {
      this.gameOver = true;
      useGameStore.getState().setStatus("victory");
      Sfx.victory();
      return;
    }
    if (this.matchTime <= 0) {
      this.gameOver = true;
      const win = this.allyGeneral.hp >= this.enemyGeneral.hp;
      useGameStore.getState().setStatus(win ? "victory" : "defeat");
      if (win) Sfx.victory();
      else Sfx.defeat();
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function pickRandomGeneral(exclude: GeneralId): GeneralId {
  const all = Object.keys(GENERAL_CATALOG) as GeneralId[];
  const filtered = all.filter((g) => g !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function matchupFavor(attacker: UnitType, defender: UnitType): boolean {
  const map: Record<UnitType, UnitType[]> = {
    infantry: ["archer"],
    spear: ["cavalry"],
    archer: ["spear"],
    cavalry: ["archer"],
  };
  return map[attacker].includes(defender);
}

// 未使用警告抑止
void PIXELS_PER_METER;
void MORALE.max;
