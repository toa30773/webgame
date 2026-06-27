import type { Faction, Vec2 } from "@/types/common";
import { Unit } from "@/game/units/Unit";
import { General } from "@/game/generals/General";
import {
  ALLY_BASE_Y,
  ENEMY_BASE_Y,
  LANE_SWITCH_Y_MAX,
  LANE_SWITCH_Y_MIN,
  LANE_X,
  MAP_HEIGHT,
} from "@/game/map/mapConfig";
import { UNIT_STATS, AI_TICK_SEC } from "@/game/skills/balance";
import { distance } from "@/utils/math";

interface AIWorld {
  allies: Unit[];
  enemies: Unit[];
  allyGeneral: General;
  enemyGeneral: General;
}

export class UnitAI {
  public static update(unit: Unit, dt: number, world: AIWorld): void {
    if (!unit.alive) return;

    unit.aiCooldown -= dt;
    if (unit.commandTimer > 0) {
      unit.commandTimer -= dt;
      if (unit.commandTimer <= 0) {
        unit.setCommand("advance");
      }
    }

    const enemies = unit.faction === "ally" ? world.enemies : world.allies;
    if (unit.aiCooldown > 0) {
      // 移動だけは毎フレーム継続(目標保持)
      this.applyMovement(unit, dt, enemies);
      return;
    }
    unit.aiCooldown = AI_TICK_SEC;
    this.decide(unit, world);
    this.applyMovement(unit, dt, enemies);
  }

  private static decide(unit: Unit, world: AIWorld): void {
    const enemies = unit.faction === "ally" ? world.enemies : world.allies;
    const friendlyGeneral =
      unit.faction === "ally" ? world.allyGeneral : world.enemyGeneral;
    const opposingGeneral =
      unit.faction === "ally" ? world.enemyGeneral : world.allyGeneral;

    const stats = UNIT_STATS[unit.type];

    // ターゲット選定
    unit.targetUnit = this.pickTargetUnit(unit, enemies);
    unit.targetGeneralRef = null;

    // 「敵将を狙え」または「総攻撃」中: 敵将優先
    if (unit.command === "targetGeneral" && opposingGeneral.alive) {
      const dToGeneral = distance(unit.position, opposingGeneral.position);
      const surrounded =
        this.countEnemiesWithin(unit.position, enemies, 2.5) >= 3;
      if (!surrounded || dToGeneral < stats.range + 1) {
        unit.targetUnit = null;
        unit.targetGeneralRef = {
          hp: opposingGeneral.hp,
          alive: opposingGeneral.alive,
          pos: opposingGeneral.position,
        };
      }
    }

    // 槍兵は騎馬優先
    if (unit.type === "spear") {
      const cav = this.pickClosestOfType(unit, enemies, "cavalry", 12);
      if (cav) unit.targetUnit = cav;
    }
    // 騎馬は弓兵優先
    if (unit.type === "cavalry") {
      const arc = this.pickClosestOfType(unit, enemies, "archer", 15);
      if (arc) unit.targetUnit = arc;
    }

    // 包囲判定: 4方向から接近されているとき、最も脅威の高い敵に切り替える
    const threats = this.findCloseThreats(unit, enemies, 4.0);
    if (threats.length >= 2 && unit.command !== "targetGeneral") {
      // 兵種ごとの脅威度 (この兵種にとって苦手な相手ほど高い)
      const threatRank: Record<typeof unit.type, number> = {
        infantry: 1,
        spear: 2,
        archer: 2,
        cavalry: 3,
      };
      // 自分が騎馬なら槍兵が最大脅威、自分が弓兵なら近接が脅威、など
      const selfHates: Record<typeof unit.type, typeof unit.type[]> = {
        infantry: ["cavalry"],
        spear: ["archer"],
        archer: ["cavalry", "infantry"],
        cavalry: ["spear"],
      };
      const hated = selfHates[unit.type];
      let mostDangerous = threats[0];
      let bestScore = -Infinity;
      for (const t of threats) {
        const baseScore = threatRank[t.type];
        const hateBoost = hated.includes(t.type) ? 5 : 0;
        const proximityBoost = 4 - distance(unit.position, t.position);
        const score = baseScore + hateBoost + proximityBoost;
        if (score > bestScore) {
          bestScore = score;
          mostDangerous = t;
        }
      }
      unit.targetUnit = mostDangerous;
      unit.targetGeneralRef = null;
    }

    // 命令: 集結
    if (unit.command === "rally") {
      const fg = friendlyGeneral.position;
      if (distance(unit.position, fg) < 2.0) {
        unit.setCommand("advance");
      } else {
        unit.targetUnit = null;
        unit.targetGeneralRef = null;
      }
    }

    // 将軍支援: 将軍が戦闘中なら近づく(かつ敵将がいれば敵将攻撃)
    const friendlyGeneralCloseDist = distance(
      unit.position,
      friendlyGeneral.position
    );
    if (friendlyGeneralCloseDist < 6 && unit.command !== "defend") {
      if (
        opposingGeneral.alive &&
        distance(friendlyGeneral.position, opposingGeneral.position) < 3 &&
        distance(unit.position, opposingGeneral.position) < 8
      ) {
        unit.targetUnit = null;
        unit.targetGeneralRef = {
          hp: opposingGeneral.hp,
          alive: opposingGeneral.alive,
          pos: opposingGeneral.position,
        };
      }
    }
  }

  private static applyMovement(unit: Unit, dt: number, enemies: Unit[]): void {
    if (!unit.canMove) return;
    const stats = UNIT_STATS[unit.type];
    const speed = stats.speed * unit.bonusSpeedMult;

    const target = this.computeMoveTarget(unit);
    if (!target) return;
    const pos = unit.position;
    let dx = target.x - pos.x;
    let dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return;

    // 弓兵: 攻撃中で射程内なら少し後退
    if (
      unit.type === "archer" &&
      unit.targetUnit &&
      unit.targetUnit.alive &&
      distance(pos, unit.targetUnit.position) < stats.range * 0.6
    ) {
      // 後ろへ
      const forwardSign = unit.faction === "ally" ? -1 : 1;
      const step = speed * dt;
      unit.setPosition({
        x: pos.x,
        y: pos.y + forwardSign * step,
      });
      return;
    }

    // 射程内なら停止
    if (unit.targetUnit && unit.targetUnit.alive) {
      const d = distance(pos, unit.targetUnit.position);
      if (d <= stats.range) return;
    }
    if (unit.targetGeneralRef && unit.targetGeneralRef.alive) {
      const d = distance(pos, unit.targetGeneralRef.pos);
      if (d <= stats.range) return;
    }

    // 騎馬: 弓兵/敵将を狙う際、進路上に妨害(槍兵・歩兵)があれば回り込む
    if (
      unit.type === "cavalry" &&
      ((unit.targetUnit && unit.targetUnit.alive &&
        (unit.targetUnit.type === "archer" || unit.targetUnit.type === "infantry")) ||
        unit.targetGeneralRef)
    ) {
      const offset = this.computeFlankOffset(pos, target, enemies);
      if (offset) {
        dx += offset.x;
        dy += offset.y;
      }
    }

    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const step = Math.min(speed * dt, len);
    const ux = dx / len;
    const uy = dy / len;
    unit.setPosition({
      x: pos.x + ux * step,
      y: pos.y + uy * step,
    });
  }

  /**
   * 騎馬の側面回り込み: 進路の前方コリドー内に脅威(槍兵/歩兵)が居れば
   * その重心の反対側へ垂直オフセットを与えて回避する。
   */
  private static computeFlankOffset(
    pos: Vec2,
    target: Vec2,
    enemies: Unit[]
  ): Vec2 | null {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return null;
    const fx = dx / len;
    const fy = dy / len;
    // 進行方向に垂直な軸 (右側 +)
    const rx = -fy;
    const ry = fx;
    const corridorLength = Math.min(8, len);
    const corridorWidth = 2.5;
    let threatCount = 0;
    let lateralSum = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.type !== "spear" && e.type !== "infantry") continue;
      const ex = e.position.x - pos.x;
      const ey = e.position.y - pos.y;
      const forwardDist = ex * fx + ey * fy;
      if (forwardDist <= 0 || forwardDist > corridorLength) continue;
      const lateralDist = ex * rx + ey * ry;
      if (Math.abs(lateralDist) > corridorWidth) continue;
      threatCount++;
      lateralSum += lateralDist;
    }
    if (threatCount === 0) return null;
    const avgLateral = lateralSum / threatCount;
    // 脅威の重心と反対側へオフセット (避ける方向)
    const sideSign = avgLateral >= 0 ? -1 : 1;
    const magnitude = 3.0;
    return { x: rx * sideSign * magnitude, y: ry * sideSign * magnitude };
  }

  private static computeMoveTarget(unit: Unit): Vec2 | null {
    if (unit.command === "rally") return null; // 集結時はAIで個別に設定
    if (unit.command === "defend") {
      // 現在位置維持
      if (unit.targetUnit && unit.targetUnit.alive) return unit.targetUnit.position;
      return null;
    }
    if (unit.command === "retreat") {
      const homeY = unit.faction === "ally" ? ALLY_BASE_Y - 2 : ENEMY_BASE_Y + 2;
      return { x: LANE_X[unit.lane], y: homeY };
    }
    if (unit.targetUnit && unit.targetUnit.alive) {
      return unit.targetUnit.position;
    }
    if (unit.targetGeneralRef && unit.targetGeneralRef.alive) {
      return unit.targetGeneralRef.pos;
    }
    // 前進: レーン上を敵本陣方向へ
    const laneX = LANE_X[unit.lane];
    const pos = unit.position;
    let targetX = laneX;
    // レーン変更可能帯以外は強制的にレーンXに固定
    if (
      pos.y < LANE_SWITCH_Y_MIN ||
      pos.y > LANE_SWITCH_Y_MAX
    ) {
      targetX = laneX;
    }
    const ty = unit.faction === "ally" ? ENEMY_BASE_Y : ALLY_BASE_Y;
    return { x: targetX, y: ty };
  }

  private static pickTargetUnit(unit: Unit, enemies: Unit[]): Unit | null {
    const stats = UNIT_STATS[unit.type];
    const detectRange = Math.max(stats.range + 4, 10);
    let best: Unit | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = distance(unit.position, e.position);
      if (d > detectRange) continue;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private static pickClosestOfType(
    unit: Unit,
    enemies: Unit[],
    type: Unit["type"],
    maxRange: number
  ): Unit | null {
    let best: Unit | null = null;
    let bestDist = maxRange;
    for (const e of enemies) {
      if (!e.alive || e.type !== type) continue;
      const d = distance(unit.position, e.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private static countEnemiesWithin(
    pos: Vec2,
    enemies: Unit[],
    range: number
  ): number {
    let count = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (distance(pos, e.position) <= range) count++;
    }
    return count;
  }

  private static findCloseThreats(
    unit: Unit,
    enemies: Unit[],
    range: number
  ): Unit[] {
    const list: Unit[] = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (distance(unit.position, e.position) <= range) list.push(e);
    }
    return list;
  }
}

// 集結命令時に将軍位置へ向かわせる更新を補助
export function applyRallyMovement(
  units: Unit[],
  general: General,
  dt: number,
  _faction: Faction
): void {
  for (const u of units) {
    if (!u.alive || u.command !== "rally" || !u.canMove) continue;
    const target = general.position;
    const pos = u.position;
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.0) {
      u.setCommand("advance");
      continue;
    }
    const stats = UNIT_STATS[u.type];
    const step = Math.min(stats.speed * u.bonusSpeedMult * dt, d);
    u.setPosition({ x: pos.x + (dx / d) * step, y: pos.y + (dy / d) * step });
  }
}
// 未使用警告抑止
void MAP_HEIGHT;
