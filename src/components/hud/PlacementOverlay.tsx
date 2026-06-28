import { useGameStore } from "@/store/gameStore";
import type { UnitType } from "@/types/common";

const UNIT_LABELS: Record<UnitType, { label: string; color: string }> = {
  infantry: { label: "歩兵", color: "#cbd5e1" },
  spear: { label: "槍兵", color: "#facc15" },
  archer: { label: "弓兵", color: "#4ade80" },
  cavalry: { label: "騎馬", color: "#f472b6" },
};

export function PlacementOverlay(): JSX.Element | null {
  const phase = useGameStore((s) => s.phase);
  const timeLeft = useGameStore((s) => s.placementTimeLeft);
  const selected = useGameStore((s) => s.placementSelected);
  const setSelected = useGameStore((s) => s.setPlacementSelected);
  const confirm = useGameStore((s) => s.requestPlacementConfirm);
  const units = useGameStore((s) => s.units);

  if (phase !== "placement") return null;

  const seconds = Math.max(0, Math.ceil(timeLeft));

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      {/* 上部: タイトル + タイマー */}
      <div className="pointer-events-auto self-center mt-2 px-4 py-2 rounded-xl bg-black/70 border border-amber-400/60 text-amber-200 font-bold flex items-center gap-3 text-sm">
        <span>作戦フェーズ</span>
        <span
          className={`text-xl tabular-nums ${
            seconds <= 5 ? "text-rose-300" : "text-amber-100"
          }`}
        >
          {seconds}s
        </span>
      </div>

      {/* 説明 */}
      <div className="self-center mt-1 px-3 py-1 rounded bg-black/55 text-slate-100 text-xs">
        部隊アイコンを選び、自陣エリアをタップして配置
      </div>

      <div className="flex-1" />

      {/* 下部: 部隊選択タブ + 準備完了 */}
      <div className="pointer-events-auto mb-4 mx-3 flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(UNIT_LABELS) as UnitType[]).map((u) => {
            const isSel = selected === u;
            const info = UNIT_LABELS[u];
            const state = units[u];
            return (
              <button
                key={u}
                type="button"
                onClick={() => setSelected(isSel ? null : u)}
                className={`px-2 py-2 rounded-lg border-2 text-center text-white font-bold transition ${
                  isSel
                    ? "bg-amber-500/30 border-amber-300"
                    : "bg-black/60 border-slate-500/60"
                }`}
                style={{ boxShadow: isSel ? `0 0 0 2px ${info.color}` : "none" }}
              >
                <div className="text-base" style={{ color: info.color }}>
                  {info.label}
                </div>
                <div className="text-[10px] opacity-80">
                  HP {Math.round(state.hp)}
                </div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={confirm}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-lg shadow-lg"
        >
          準備完了
        </button>
      </div>
    </div>
  );
}
