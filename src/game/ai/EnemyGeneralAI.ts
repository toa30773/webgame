import type { Vec2 } from "@/types/common";
import { General } from "@/game/generals/General";
import { Unit } from "@/game/units/Unit";
import { distance } from "@/utils/math";
import { LANE_X, ALLY_BASE_Y, ENEMY_BASE_Y } from "@/game/map/mapConfig";

/**
 * 敵将AI
 * - 自軍部隊の前線に合わせて進む (単騎で突っ込まない)
 * - プレイヤー将軍が孤立 / 前線を越えたら攻めに切り替え
 * - HP25%以下で後退
 * - 攻撃範囲に入っていれば通常攻撃
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
      // 後退して自軍本陣近くへ
      goal = { x: LANE_X.center, y: ENEMY_BASE_Y + 4 };
    } else {
      const aliveAllies = allies.filter((u) => u.alive);
      if (aliveAllies.length === 0) {
        // 部隊が全滅 → 最後の抵抗で敵将に向かう
        goal = tpos;
      } else {
        // 自軍前線 (敵側にとっては Y最大の味方ユニット)
        const leadingY = aliveAllies.reduce(
          (best, u) => Math.max(best, u.position.y),
          -Infinity
        );
        // プレイヤー将軍まわりに何体の味方がいるか
        const supportNear = aliveAllies.filter(
          (u) => distance(u.position, tpos) < 5
        ).length;

        // 攻めに切り替える条件:
        // 1. プレイヤーがすぐ近く (向こうから来た) → 殴り合う
        // 2. 前線がプレイヤー将軍まで到達 + 味方が周囲にいる
        // 3. プレイヤー将軍がHP低下していて、味方の支援が1体でもある
        const playerHpRatio = target.hp / target.hpMax;
        const wantsEngage =
          d < 4 ||
          (leadingY >= tpos.y - 3 && supportNear >= 1) ||
          (playerHpRatio < 0.4 && supportNear >= 1 && d < 9);

        if (wantsEngage) {
          goal = tpos;
        } else {
          // 前線の少し後ろに付く。プレイヤーと横位置を揃える。
          const followY = leadingY - 2;
          const minY = ENEMY_BASE_Y + 2;
          const maxY = tpos.y - 1.5;
          const goalY = Math.max(minY, Math.min(followY, maxY));
          // 横はプレイヤー将軍と少しオフセットを保ち、レーン中央寄りに
          const towardCenter =
            tpos.x + (LANE_X.center - tpos.x) * 0.3;
          goal = { x: towardCenter, y: goalY };
        }
      }
    }

    // 移動
    if (!general.canMove) return;
    const slowMult = general.attackSlowdownTimer > 0 ? 0.5 : 1.0;
    const speed = stats.speed * slowMult * general.bonusSpeedMult;
    const dx = goal.x - pos.x;
    const dy = goal.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) return;
    const step = Math.min(speed * dt, dist);
    general.setPosition({
      x: pos.x + (dx / dist) * step,
      y: pos.y + (dy / dist) * step,
    });
  }
}

// 未使用警告抑止
void ALLY_BASE_Y;
