import type { Vec2 } from "@/types/common";
import { General } from "@/game/generals/General";
import { Unit } from "@/game/units/Unit";
import { distance } from "@/utils/math";
import { LANE_X, ALLY_BASE_Y, ENEMY_BASE_Y } from "@/game/map/mapConfig";

/**
 * 敵将AI
 * - 自軍部隊と歩調を合わせて前進
 * - 味方が前線で戦闘中なら参戦
 * - HP25%以下で後退
 * - 敵を攻撃範囲に捉えたら通常攻撃
 */
export class EnemyGeneralAI {
  public static update(
    general: General,
    target: General,
    allies: Unit[],
    dt: number,
    onAttack: (dmg: number) => void
  ): void {
    if (!general.alive || !target.alive) return;
    general.attackCooldown = Math.max(0, general.attackCooldown - dt);
    general.attackSlowdownTimer = Math.max(
      0,
      general.attackSlowdownTimer - dt
    );

    const pos = general.position;
    const tpos = target.position;
    const d = distance(pos, tpos);

    const stats = general.def.stats;
    // 攻撃: 敵将が範囲内
    if (d <= stats.attackRange + 0.4 && general.attackCooldown <= 0) {
      general.attackCooldown = stats.attackInterval;
      general.attackSlowdownTimer = 0.3;
      const dmg = stats.attackDamage * general.bonusAttackMult;
      onAttack(dmg);
      return;
    }

    // 移動目標を判定
    const hpRatio = general.hp / general.hpMax;
    let goal: Vec2;
    if (hpRatio < 0.25) {
      // 後退して味方本陣近くへ
      goal = { x: LANE_X.center, y: ENEMY_BASE_Y + 4 };
    } else {
      // 味方部隊が敵将と接近戦中なら参戦
      const allyEngaged = allies.find(
        (u) => u.alive && distance(u.position, tpos) < 5
      );
      if (allyEngaged) {
        goal = tpos;
      } else if (hpRatio < 0.5 && d > 12) {
        // 半分以下で距離があるなら味方と合流
        const nearest = nearestAliveAlly(pos, allies);
        goal = nearest ?? tpos;
      } else {
        // 主目標: プレイヤー将軍
        goal = tpos;
      }
    }

    // 移動
    if (!general.canMove) return;
    const slowMult = general.attackSlowdownTimer > 0 ? 0.5 : 1.0;
    const speed = stats.speed * slowMult * general.bonusSpeedMult;
    const dx = goal.x - pos.x;
    const dy = goal.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return;
    const step = Math.min(speed * dt, dist);
    general.setPosition({
      x: pos.x + (dx / dist) * step,
      y: pos.y + (dy / dist) * step,
    });
  }
}

function nearestAliveAlly(pos: Vec2, allies: Unit[]): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const u of allies) {
    if (!u.alive) continue;
    const d = distance(pos, u.position);
    if (d < bestD) {
      bestD = d;
      best = u.position;
    }
  }
  return best;
}

// 未使用警告抑止
void ALLY_BASE_Y;
