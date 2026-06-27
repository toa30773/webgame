import type { GeneralStats } from "@/types/common";

export type GeneralId = "warrior" | "bulwark" | "skirmisher" | "tactician";

export type UniqueSkillId =
  | "rallyAura"
  | "ironWall"
  | "shadowDash"
  | "battleCry";

export interface UniqueSkillDef {
  id: UniqueSkillId;
  label: string;
  description: string;
  cooldown: number;
  duration: number;
  /** 即時発動か持続効果か */
  instant: boolean;
}

export interface GeneralDef {
  id: GeneralId;
  name: string;
  symbol: string; // 将軍アイコンに表示する1文字
  description: string;
  stats: GeneralStats;
  /** 将軍へのオーラ範囲倍率 (基準1.0) */
  auraRadiusMult: number;
  unique: UniqueSkillDef;
}

export const GENERAL_CATALOG: Record<GeneralId, GeneralDef> = {
  warrior: {
    id: "warrior",
    name: "戦将",
    symbol: "戦",
    description: "万能型。すべてのバランスがとれた指揮官。",
    stats: {
      hp: 3000,
      speed: 6.0,
      attackInterval: 1.0,
      attackDamage: 120,
      attackRange: 1.2,
      dodgeCooldown: 8,
    },
    auraRadiusMult: 1.0,
    unique: {
      id: "rallyAura",
      label: "鼓舞陣",
      description: "周囲味方の攻撃+30%、6秒",
      cooldown: 20,
      duration: 6,
      instant: false,
    },
  },
  bulwark: {
    id: "bulwark",
    name: "剛将",
    symbol: "剛",
    description: "重装。HP・攻撃力が高いが鈍重。",
    stats: {
      hp: 4200,
      speed: 4.5,
      attackInterval: 1.1,
      attackDamage: 140,
      attackRange: 1.3,
      dodgeCooldown: 10,
    },
    auraRadiusMult: 1.2,
    unique: {
      id: "ironWall",
      label: "鉄壁",
      description: "自分の防御+60%、5秒",
      cooldown: 18,
      duration: 5,
      instant: false,
    },
  },
  skirmisher: {
    id: "skirmisher",
    name: "疾風将",
    symbol: "疾",
    description: "高機動。HPは少ないが奇襲・離脱が得意。",
    stats: {
      hp: 2200,
      speed: 8.0,
      attackInterval: 0.9,
      attackDamage: 100,
      attackRange: 1.0,
      dodgeCooldown: 5,
    },
    auraRadiusMult: 0.8,
    unique: {
      id: "shadowDash",
      label: "瞬影",
      description: "視線方向に8m瞬間移動",
      cooldown: 15,
      duration: 0,
      instant: true,
    },
  },
  tactician: {
    id: "tactician",
    name: "智将",
    symbol: "智",
    description: "司令塔。短時間、全部隊に一斉命令が可能。",
    stats: {
      hp: 2800,
      speed: 5.5,
      attackInterval: 1.0,
      attackDamage: 100,
      attackRange: 1.2,
      dodgeCooldown: 8,
    },
    auraRadiusMult: 1.1,
    unique: {
      id: "battleCry",
      label: "総号令",
      description: "次の命令ボタンが全部隊適用に。4秒",
      cooldown: 25,
      duration: 4,
      instant: false,
    },
  },
};

export const DEFAULT_GENERAL_ID: GeneralId = "warrior";
