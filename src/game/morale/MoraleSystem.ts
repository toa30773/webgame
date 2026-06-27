import type { MoraleSkillType } from "@/types/common";
import { MORALE, MORALE_SKILLS } from "@/game/skills/balance";

export interface MoraleEvents {
  killSoldier(): void;
  killSquad(): void;
  damageEnemyGeneral(amount: number): void;
}

export class MoraleSystem {
  public value = 0;
  private generalDamageBuffer = 0;
  private activeSkill: MoraleSkillType | null = null;
  private activeSkillTime = 0;

  public update(dt: number): void {
    this.value = Math.min(MORALE.max, this.value + MORALE.perSecond * dt);
    if (this.activeSkill && this.activeSkillTime > 0) {
      this.activeSkillTime -= dt;
      if (this.activeSkillTime <= 0) {
        this.activeSkill = null;
        this.activeSkillTime = 0;
      }
    }
  }

  public get current(): number {
    return this.value;
  }

  public get currentActiveSkill(): MoraleSkillType | null {
    return this.activeSkill;
  }

  public get currentActiveSkillTime(): number {
    return this.activeSkillTime;
  }

  public onKillSoldier(count = 1): void {
    this.value = Math.min(MORALE.max, this.value + MORALE.perKill * count);
  }

  public onKillSquad(): void {
    this.value = Math.min(MORALE.max, this.value + MORALE.perSquadKill);
  }

  public onDamageEnemyGeneral(amount: number): void {
    this.generalDamageBuffer += amount;
    while (this.generalDamageBuffer >= 100) {
      this.value = Math.min(MORALE.max, this.value + MORALE.perGeneralDamage100);
      this.generalDamageBuffer -= 100;
    }
  }

  public canUse(type: MoraleSkillType): boolean {
    return this.value >= MORALE_SKILLS[type].cost && this.activeSkill === null;
  }

  public use(type: MoraleSkillType): boolean {
    const def = MORALE_SKILLS[type];
    if (this.value < def.cost) return false;
    if (this.activeSkill !== null && !def.instant) return false;
    this.value -= def.cost;
    if (def.instant) {
      // 集結など即時はsetSkillしない
      return true;
    }
    this.activeSkill = type;
    this.activeSkillTime = def.duration;
    return true;
  }
}
