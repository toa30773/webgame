import type { UnitType } from "@/types/common";
import {
  MATCHUP,
  UNIT_TO_GENERAL_MULT,
  GENERAL_AURA,
} from "@/game/skills/balance";

interface UnitDamageParams {
  attackerType: UnitType;
  attackerBaseAttack: number;
  attackerSoldierRatio: number;
  attackerSkillMult: number;
  attackerAuraBonusAttack: number;
  defenderType: UnitType;
  defenderSkillDefenseMult: number;
}

export function computeUnitVsUnitDamage(p: UnitDamageParams): number {
  const matchup = MATCHUP[p.attackerType]?.[p.defenderType] ?? 1.0;
  const dmg =
    p.attackerBaseAttack *
    p.attackerSoldierRatio *
    matchup *
    p.attackerSkillMult *
    (1 + p.attackerAuraBonusAttack) *
    p.defenderSkillDefenseMult;
  return dmg;
}

export function computeUnitVsGeneralDamage(params: {
  attackerType: UnitType;
  attackerBaseAttack: number;
  attackerSoldierRatio: number;
  attackerSkillMult: number;
  attackerAuraBonusAttack: number;
  generalDefenseMult: number;
}): number {
  const generalMult = UNIT_TO_GENERAL_MULT[params.attackerType];
  return (
    params.attackerBaseAttack *
    params.attackerSoldierRatio *
    generalMult *
    params.attackerSkillMult *
    (1 + params.attackerAuraBonusAttack) *
    params.generalDefenseMult
  );
}

export function computeGeneralVsUnitDamage(params: {
  baseAttack: number;
  attackerSkillMult: number;
  defenderSkillDefenseMult: number;
}): number {
  return (
    params.baseAttack *
    params.attackerSkillMult *
    params.defenderSkillDefenseMult
  );
}

export function computeGeneralVsGeneralDamage(params: {
  baseAttack: number;
  attackerSkillMult: number;
  defenderSkillDefenseMult: number;
}): number {
  return (
    params.baseAttack *
    params.attackerSkillMult *
    params.defenderSkillDefenseMult
  );
}

export function isInAuraRange(distanceM: number): boolean {
  return distanceM <= GENERAL_AURA.radius;
}
