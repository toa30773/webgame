import { MORALE_SKILLS } from "@/game/skills/balance";
import { useGameStore } from "@/store/gameStore";
import { useInputStore } from "@/store/inputStore";
import type { MoraleSkillType } from "@/types/common";

const ORDER: MoraleSkillType[] = [
  "charge",
  "defenseFormation",
  "rally",
  "inspire",
  "totalAttack",
];

export function MoraleSkillBar(): JSX.Element {
  const morale = useGameStore((s) => s.morale);
  const active = useGameStore((s) => s.activeSkill);
  const activeTime = useGameStore((s) => s.activeSkillTimeLeft);
  const issue = useInputStore((s) => s.issueMoraleSkill);
  return (
    <div className="absolute top-16 right-2 flex flex-col gap-1 pointer-events-auto">
      {ORDER.map((t) => {
        const def = MORALE_SKILLS[t];
        const enough = morale >= def.cost;
        const isActive = active === t;
        const someoneActive = active !== null && !def.instant;
        const disabled = !enough || (someoneActive && !isActive);
        return (
          <button
            key={t}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (!disabled) issue(t);
            }}
            className={`relative px-2 py-1 rounded text-xs font-bold border w-20 text-left ${
              isActive
                ? "bg-amber-500/80 border-amber-200 text-white"
                : disabled
                ? "bg-slate-800/60 border-white/20 text-white/50"
                : "bg-slate-800/90 border-white/60 text-white"
            }`}
            style={{ touchAction: "none" }}
          >
            <div className="flex items-baseline justify-between">
              <span>{def.label}</span>
              <span className="text-[9px] opacity-70">{def.cost}</span>
            </div>
            {isActive ? (
              <div className="text-[9px] opacity-80">
                {activeTime.toFixed(1)}s
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
