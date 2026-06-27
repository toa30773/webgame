import type {
  CommandType,
  MoraleSkillType,
  UnitType,
  Vec2,
} from "@/types/common";

export type Role = "host" | "guest";

export interface UnitSnapshot {
  type: UnitType;
  faction: "ally" | "enemy";
  alive: boolean;
  pos: Vec2;
  hp: number;
  soldiers: number;
  command: CommandType;
  respawnIn: number;
}

export interface GeneralSnapshot {
  faction: "ally" | "enemy";
  alive: boolean;
  pos: Vec2;
  hp: number;
  dodgeCd: number;
  dodgeCdMax: number;
  uniqueCd: number;
  uniqueCdMax: number;
  uniqueActive: number;
}

export interface BattleSnapshot {
  t: number; // server time seconds (host time)
  matchTimeLeft: number;
  status: "playing" | "victory" | "defeat";
  generals: GeneralSnapshot[];
  units: UnitSnapshot[];
  // ホストから見た「ally士気」「enemy士気」
  hostMorale: number;
  guestMorale: number;
  hostActiveSkill: MoraleSkillType | null;
  hostActiveSkillTime: number;
  guestActiveSkill: MoraleSkillType | null;
  guestActiveSkillTime: number;
}

export type NetMessage =
  | { type: "snapshot"; payload: BattleSnapshot }
  | { type: "input"; from: Role; moveX: number; moveY: number }
  | { type: "attack"; from: Role; seq: number }
  | { type: "dodge"; from: Role; seq: number }
  | { type: "uniqueSkill"; from: Role; seq: number }
  | { type: "command"; from: Role; unit: UnitType; command: CommandType }
  | { type: "moraleSkill"; from: Role; skill: MoraleSkillType }
  | { type: "ping"; from: Role; sentAt: number }
  | { type: "pong"; from: Role; sentAt: number }
  | { type: "ready"; from: Role }
  | { type: "leave"; from: Role };
