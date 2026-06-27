import type { CommandType, UnitType } from "@/types/common";
import { useGameStore } from "@/store/gameStore";
import { useInputStore } from "@/store/inputStore";

const TYPES: UnitType[] = ["infantry", "spear", "archer", "cavalry"];
const TYPE_LABEL: Record<UnitType, string> = {
  infantry: "歩兵",
  spear: "槍兵",
  archer: "弓兵",
  cavalry: "騎馬",
};

const COMMANDS: { type: CommandType; label: string }[] = [
  { type: "advance", label: "前進" },
  { type: "retreat", label: "後退" },
  { type: "defend", label: "防衛" },
  { type: "targetGeneral", label: "敵将" },
  { type: "rally", label: "集結" },
];

export function UnitPanel(): JSX.Element {
  const selected = useGameStore((s) => s.selectedUnit);
  const units = useGameStore((s) => s.units);
  const setSelected = useGameStore((s) => s.setSelectedUnit);
  const issueCommand = useInputStore((s) => s.issueCommand);

  const selectedAlive = selected ? units[selected].alive : false;
  return (
    <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
      {selected ? (
        <div className="flex gap-1 bg-black/60 rounded-xl border border-white/20 px-2 py-1">
          {COMMANDS.map((c) => {
            const active = units[selected].command === c.type;
            const disabled = !selectedAlive;
            return (
              <button
                key={c.type}
                type="button"
                disabled={disabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (!disabled) issueCommand(selected, c.type);
                }}
                className={`min-w-[44px] px-2 py-1 rounded text-xs font-bold text-white border ${
                  disabled
                    ? "bg-slate-900/70 border-white/10 text-white/40"
                    : active
                    ? "bg-amber-500/80 border-amber-300"
                    : "bg-slate-800/80 border-white/40"
                }`}
                style={{ touchAction: "none" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="flex gap-2">
        {TYPES.map((t) => {
          const u = units[t];
          const isSel = selected === t;
          const ratio = u.hp / u.hpMax;
          const dead = !u.alive;
          return (
            <button
              key={t}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setSelected(isSel ? null : t);
              }}
              className={`relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-white ${
                isSel
                  ? "bg-amber-600/80 border-amber-200 shadow-[0_0_8px_2px_rgba(252,211,77,0.7)]"
                  : "bg-slate-800/80 border-white/40"
              }`}
              style={{ touchAction: "none" }}
            >
              <span className="text-sm leading-tight">{TYPE_LABEL[t]}</span>
              <span className="text-[10px] opacity-80">
                {dead ? `${Math.ceil(u.respawnIn)}s` : `${u.soldiers}/${u.soldiersMax}`}
              </span>
              <span
                className="absolute bottom-0 left-0 h-1 rounded-b bg-green-500"
                style={{ width: `${ratio * 100}%` }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
