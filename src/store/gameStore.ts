import { create } from "zustand";
import type { CommandType, MoraleSkillType, UnitType } from "@/types/common";

export type GameStatus = "playing" | "victory" | "defeat";
export type GamePhase = "placement" | "battle";

interface UnitHudState {
  type: UnitType;
  hp: number;
  hpMax: number;
  soldiers: number;
  soldiersMax: number;
  alive: boolean;
  respawnIn: number;
  command: CommandType;
}

interface GameStore {
  allyGeneralHp: number;
  allyGeneralHpMax: number;
  enemyGeneralHp: number;
  enemyGeneralHpMax: number;
  morale: number;
  moraleMax: number;
  matchTimeLeft: number;
  status: GameStatus;
  selectedUnit: UnitType | null;
  units: Record<UnitType, UnitHudState>;
  dodgeCooldownLeft: number;
  activeSkill: MoraleSkillType | null;
  activeSkillTimeLeft: number;
  paused: boolean;
  hapticsEnabled: boolean;
  sfxEnabled: boolean;
  uniqueCooldownLeft: number;
  uniqueCooldownMax: number;
  uniqueActiveTime: number;
  phase: GamePhase;
  placementTimeLeft: number;
  placementSelected: UnitType | null;
  placementConfirmSeq: number;

  setAllyGeneralHp: (hp: number) => void;
  setEnemyGeneralHp: (hp: number) => void;
  setMorale: (m: number) => void;
  setMatchTimeLeft: (t: number) => void;
  setStatus: (s: GameStatus) => void;
  setSelectedUnit: (u: UnitType | null) => void;
  setUnit: (u: UnitType, patch: Partial<UnitHudState>) => void;
  setDodgeCooldown: (t: number) => void;
  setActiveSkill: (s: MoraleSkillType | null, time: number) => void;
  setPaused: (p: boolean) => void;
  togglePaused: () => void;
  setHapticsEnabled: (e: boolean) => void;
  setSfxEnabled: (e: boolean) => void;
  setUniqueState: (cdLeft: number, cdMax: number, activeTime: number) => void;
  setPhase: (p: GamePhase) => void;
  setPlacementTimeLeft: (t: number) => void;
  setPlacementSelected: (u: UnitType | null) => void;
  requestPlacementConfirm: () => void;
  reset: (allyMaxHp: number, enemyMaxHp: number, matchSec: number) => void;
}

function makeUnit(type: UnitType, hpMax: number, soldiersMax: number): UnitHudState {
  return {
    type,
    hp: hpMax,
    hpMax,
    soldiers: soldiersMax,
    soldiersMax,
    alive: true,
    respawnIn: 0,
    command: "advance",
  };
}

export const useGameStore = create<GameStore>((set) => ({
  allyGeneralHp: 3000,
  allyGeneralHpMax: 3000,
  enemyGeneralHp: 3000,
  enemyGeneralHpMax: 3000,
  morale: 0,
  moraleMax: 100,
  matchTimeLeft: 240,
  status: "playing",
  selectedUnit: null,
  units: {
    infantry: makeUnit("infantry", 1000, 10),
    spear: makeUnit("spear", 900, 8),
    archer: makeUnit("archer", 700, 8),
    cavalry: makeUnit("cavalry", 800, 5),
  },
  dodgeCooldownLeft: 0,
  activeSkill: null,
  activeSkillTimeLeft: 0,
  paused: false,
  hapticsEnabled: true,
  sfxEnabled: true,
  uniqueCooldownLeft: 0,
  uniqueCooldownMax: 1,
  uniqueActiveTime: 0,
  phase: "placement",
  placementTimeLeft: 30,
  placementSelected: null,
  placementConfirmSeq: 0,

  setAllyGeneralHp: (hp) => set({ allyGeneralHp: Math.max(0, hp) }),
  setEnemyGeneralHp: (hp) => set({ enemyGeneralHp: Math.max(0, hp) }),
  setMorale: (m) => set({ morale: m }),
  setMatchTimeLeft: (t) => set({ matchTimeLeft: t }),
  setStatus: (s) => set({ status: s }),
  setSelectedUnit: (u) => set({ selectedUnit: u }),
  setUnit: (u, patch) =>
    set((state) => {
      const prev = state.units[u];
      // どのフィールドも変わらないなら再生成しない (毎フレーム呼ばれるので)
      let changed = false;
      for (const k in patch) {
        if ((prev as unknown as Record<string, unknown>)[k] !==
            (patch as unknown as Record<string, unknown>)[k]) {
          changed = true;
          break;
        }
      }
      if (!changed) return state;
      return {
        units: {
          ...state.units,
          [u]: { ...prev, ...patch },
        },
      };
    }),
  setDodgeCooldown: (t) => set({ dodgeCooldownLeft: t }),
  setActiveSkill: (s, time) => set({ activeSkill: s, activeSkillTimeLeft: time }),
  setPaused: (p) => set({ paused: p }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setHapticsEnabled: (e) => set({ hapticsEnabled: e }),
  setSfxEnabled: (e) => set({ sfxEnabled: e }),
  setUniqueState: (cdLeft, cdMax, activeTime) =>
    set({
      uniqueCooldownLeft: cdLeft,
      uniqueCooldownMax: cdMax,
      uniqueActiveTime: activeTime,
    }),
  setPhase: (p) => set({ phase: p }),
  setPlacementTimeLeft: (t) => set({ placementTimeLeft: t }),
  setPlacementSelected: (u) => set({ placementSelected: u }),
  requestPlacementConfirm: () =>
    set((s) => ({ placementConfirmSeq: s.placementConfirmSeq + 1 })),
  reset: (allyMaxHp, enemyMaxHp, matchSec) =>
    set({
      allyGeneralHp: allyMaxHp,
      allyGeneralHpMax: allyMaxHp,
      enemyGeneralHp: enemyMaxHp,
      enemyGeneralHpMax: enemyMaxHp,
      morale: 0,
      matchTimeLeft: matchSec,
      status: "playing",
      selectedUnit: null,
      dodgeCooldownLeft: 0,
      activeSkill: null,
      activeSkillTimeLeft: 0,
      paused: false,
      phase: "placement",
      placementTimeLeft: 30,
      placementSelected: null,
      units: {
        infantry: makeUnit("infantry", 1000, 10),
        spear: makeUnit("spear", 900, 8),
        archer: makeUnit("archer", 700, 8),
        cavalry: makeUnit("cavalry", 800, 5),
      },
    }),
}));
