import type {
  GeneralStats,
  MoraleSkillType,
  UnitStats,
  UnitType,
} from "@/types/common";

export const GENERAL: GeneralStats = {
  hp: 3000,
  speed: 6.0,
  attackInterval: 1.0,
  attackDamage: 120,
  attackRange: 1.2,
  dodgeCooldown: 8,
};

export const GENERAL_AURA = {
  radius: 6,
  attackBonus: 0.1,
  defenseBonus: 0.1,
};

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: {
    soldiers: 10,
    hp: 1000,
    attack: 50,
    attackInterval: 1.0,
    speed: 3.5,
    range: 1.0,
  },
  spear: {
    soldiers: 8,
    hp: 900,
    attack: 60,
    attackInterval: 1.2,
    speed: 3.2,
    range: 1.1,
  },
  archer: {
    soldiers: 8,
    hp: 700,
    attack: 45,
    attackInterval: 1.1,
    speed: 2.8,
    range: 7.0,
  },
  cavalry: {
    soldiers: 5,
    hp: 800,
    attack: 80,
    attackInterval: 1.0,
    speed: 6.0,
    range: 1.0,
  },
};

// 兵種相性表 attacker -> defender -> multiplier
export const MATCHUP: Record<UnitType, Partial<Record<UnitType, number>>> = {
  infantry: { archer: 1.2, cavalry: 0.8 },
  spear: { cavalry: 1.8, archer: 0.8 },
  archer: { spear: 1.2, cavalry: 0.8 },
  cavalry: { archer: 1.8, spear: 0.7 },
};

// ユニット → 将軍へのダメージ倍率
export const UNIT_TO_GENERAL_MULT: Record<UnitType, number> = {
  infantry: 1.0,
  spear: 1.0,
  archer: 0.8,
  cavalry: 1.2,
};

export const MORALE = {
  max: 100,
  perSecond: 1,
  perKill: 1,
  perSquadKill: 15,
  perGeneralDamage100: 5,
};

export interface MoraleSkillDef {
  type: MoraleSkillType;
  label: string;
  cost: number;
  duration: number;
  instant: boolean;
  description: string;
}

export const MORALE_SKILLS: Record<MoraleSkillType, MoraleSkillDef> = {
  charge: {
    type: "charge",
    label: "突撃",
    cost: 20,
    duration: 8,
    instant: false,
    description: "移動+30% / 攻撃+20%",
  },
  defenseFormation: {
    type: "defenseFormation",
    label: "防御陣形",
    cost: 20,
    duration: 8,
    instant: false,
    description: "防御+30% / 移動不可",
  },
  rally: {
    type: "rally",
    label: "集結",
    cost: 15,
    duration: 0,
    instant: true,
    description: "全部隊が将軍へ集合",
  },
  totalAttack: {
    type: "totalAttack",
    label: "総攻撃",
    cost: 40,
    duration: 10,
    instant: false,
    description: "全軍が敵将を優先攻撃",
  },
  inspire: {
    type: "inspire",
    label: "鼓舞",
    cost: 30,
    duration: 10,
    instant: false,
    description: "将軍周囲 攻+20% 防+20%",
  },
};

export const MATCH_DURATION_SEC = 8 * 60;

export const RESPAWN_SEC = 20;
export const RESPAWN_IN_BASE_SEC = 15;

export const AI_TICK_SEC = 0.2;
