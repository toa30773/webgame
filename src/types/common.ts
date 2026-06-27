export type Faction = "ally" | "enemy";

export type Lane = "left" | "center" | "right";

export type UnitType = "infantry" | "spear" | "archer" | "cavalry";

export type CommandType =
  | "advance"
  | "retreat"
  | "defend"
  | "targetGeneral"
  | "rally";

export type MoraleSkillType =
  | "charge"
  | "defenseFormation"
  | "rally"
  | "totalAttack"
  | "inspire";

export interface Vec2 {
  x: number;
  y: number;
}

export interface GeneralStats {
  hp: number;
  speed: number;
  attackInterval: number;
  attackDamage: number;
  attackRange: number;
  dodgeCooldown: number;
}

export interface UnitStats {
  soldiers: number;
  hp: number;
  attack: number;
  attackInterval: number;
  speed: number;
  range: number;
}
