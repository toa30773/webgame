import { create } from "zustand";
import type { CommandType, MoraleSkillType, UnitType } from "@/types/common";

interface InputStore {
  moveX: number;
  moveY: number;
  attackPressed: number;
  dodgePressed: number;
  skillPressed: number;
  // 命令キュー: コマンドの度に [seq, unit, command] を更新
  commandSeq: number;
  commandUnit: UnitType | null;
  commandType: CommandType | null;
  // 士気スキルキュー
  moraleSkillSeq: number;
  moraleSkillType: MoraleSkillType | null;

  setMove: (x: number, y: number) => void;
  pressAttack: () => void;
  pressDodge: () => void;
  pressSkill: () => void;
  issueCommand: (unit: UnitType, command: CommandType) => void;
  issueMoraleSkill: (skill: MoraleSkillType) => void;
}

export const useInputStore = create<InputStore>((set) => ({
  moveX: 0,
  moveY: 0,
  attackPressed: 0,
  dodgePressed: 0,
  skillPressed: 0,
  commandSeq: 0,
  commandUnit: null,
  commandType: null,
  moraleSkillSeq: 0,
  moraleSkillType: null,

  setMove: (x, y) => set({ moveX: x, moveY: y }),
  pressAttack: () => set((s) => ({ attackPressed: s.attackPressed + 1 })),
  pressDodge: () => set((s) => ({ dodgePressed: s.dodgePressed + 1 })),
  pressSkill: () => set((s) => ({ skillPressed: s.skillPressed + 1 })),
  issueCommand: (unit, command) =>
    set((s) => ({
      commandSeq: s.commandSeq + 1,
      commandUnit: unit,
      commandType: command,
    })),
  issueMoraleSkill: (skill) =>
    set((s) => ({
      moraleSkillSeq: s.moraleSkillSeq + 1,
      moraleSkillType: skill,
    })),
}));
