import { useInputStore } from "@/store/inputStore";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { GENERAL_CATALOG } from "@/game/generals/generalsCatalog";

interface ActionButtonProps {
  label: string;
  sublabel?: string;
  cdRatio?: number;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function ActionButton(props: ActionButtonProps): JSX.Element {
  const ratio = Math.max(0, Math.min(1, props.cdRatio ?? 0));
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!props.disabled) props.onPress();
      }}
      className={`relative w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center font-bold text-white shadow-lg active:scale-95 transition select-none ${
        props.active
          ? "bg-amber-500/90 border-amber-200"
          : props.disabled
          ? "bg-slate-700/70 border-slate-500/60 opacity-60"
          : "bg-slate-800/80 border-white/60"
      }`}
      style={{ touchAction: "none" }}
    >
      <span className="text-[12px] leading-tight text-center px-1">
        {props.label}
      </span>
      {props.sublabel ? (
        <span className="text-[9px] opacity-80">{props.sublabel}</span>
      ) : null}
      {ratio > 0 ? (
        <span
          className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs"
          style={{
            clipPath: `polygon(50% 50%, 50% 0%, ${
              50 + 50 * Math.sin(Math.PI * 2 * ratio)
            }% ${50 - 50 * Math.cos(Math.PI * 2 * ratio)}%, ${
              ratio > 0.125 ? "100% 0%, " : ""
            }${ratio > 0.375 ? "100% 100%, " : ""}${
              ratio > 0.625 ? "0% 100%, " : ""
            }${ratio > 0.875 ? "0% 0%, " : ""}50% 0%)`,
          }}
        />
      ) : null}
    </button>
  );
}

export function ActionButtons(): JSX.Element {
  const dodgeCd = useGameStore((s) => s.dodgeCooldownLeft);
  const uniqueCdLeft = useGameStore((s) => s.uniqueCooldownLeft);
  const uniqueCdMax = useGameStore((s) => s.uniqueCooldownMax);
  const uniqueActive = useGameStore((s) => s.uniqueActiveTime);
  const myGeneralId = useSessionStore((s) => s.myGeneral);
  const generalDef = GENERAL_CATALOG[myGeneralId];
  const press = useInputStore;
  const dodgeRatio =
    dodgeCd > 0 ? dodgeCd / generalDef.stats.dodgeCooldown : 0;
  const uniqueRatio = uniqueCdLeft > 0 ? uniqueCdLeft / uniqueCdMax : 0;
  return (
    <div
      className="absolute flex items-end gap-3"
      style={{
        right: `calc(env(safe-area-inset-right) + 1.5rem)`,
        bottom: `calc(env(safe-area-inset-bottom) + 1.5rem)`,
      }}
    >
      <ActionButton
        label={generalDef.unique.label}
        sublabel={uniqueActive > 0 ? `${uniqueActive.toFixed(1)}s` : undefined}
        cdRatio={uniqueRatio}
        active={uniqueActive > 0}
        disabled={uniqueRatio > 0 || uniqueActive > 0}
        onPress={() => press.getState().pressSkill()}
      />
      <ActionButton
        label="回避"
        cdRatio={dodgeRatio}
        disabled={dodgeRatio > 0}
        onPress={() => press.getState().pressDodge()}
      />
      <ActionButton label="攻撃" onPress={() => press.getState().pressAttack()} />
    </div>
  );
}
