import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function TopBar(): JSX.Element {
  const enemyHp = useGameStore((s) => s.enemyGeneralHp);
  const enemyMax = useGameStore((s) => s.enemyGeneralHpMax);
  const myHp = useGameStore((s) => s.allyGeneralHp);
  const myMax = useGameStore((s) => s.allyGeneralHpMax);
  const time = useGameStore((s) => s.matchTimeLeft);
  const morale = useGameStore((s) => s.morale);
  const moraleMax = useGameStore((s) => s.moraleMax);
  const paused = useGameStore((s) => s.paused);
  const togglePaused = useGameStore((s) => s.togglePaused);
  const battleMode = useSessionStore((s) => s.battleMode);
  const pingMs = useSessionStore((s) => s.pingMs);
  const isOnline = battleMode.kind !== "ai";
  const enemyRatio = Math.max(0, enemyHp / enemyMax);
  const myRatio = Math.max(0, myHp / myMax);
  const moraleRatio = morale / moraleMax;
  return (
    <div className="absolute top-0 inset-x-0 px-3 pt-2 pb-1 flex flex-col gap-1 text-white pointer-events-none safe-top safe-left safe-right">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-red-200">敵将 HP</div>
          <div className="h-3 bg-black/50 rounded overflow-hidden border border-white/30">
            <div
              className="h-full bg-red-500"
              style={{ width: `${enemyRatio * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="px-2 py-1 bg-black/50 rounded text-xs font-mono">
            {formatTime(time)}
          </div>
          {isOnline && (
            <div
              className={`text-[9px] font-mono mt-0.5 ${
                pingMs < 100
                  ? "text-green-300"
                  : pingMs < 250
                  ? "text-amber-300"
                  : "text-red-300"
              }`}
            >
              {pingMs > 0 ? `${pingMs}ms` : "--"}
            </div>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            togglePaused();
          }}
          className="pointer-events-auto px-2 py-1 bg-black/60 border border-white/30 rounded text-xs font-bold"
          style={{ touchAction: "none" }}
          title={isOnline ? "メニュー (オンライン中は停止不可)" : "一時停止"}
        >
          {paused ? "▶" : isOnline ? "≡" : "❚❚"}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-amber-200 text-right">士気</div>
          <div className="h-3 bg-black/50 rounded overflow-hidden border border-white/30">
            <div
              className={`h-full ${
                moraleRatio >= 1 ? "bg-amber-300 animate-pulse" : "bg-amber-500"
              }`}
              style={{ width: `${moraleRatio * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <div className="text-[10px] text-blue-200">自将 HP</div>
        <div className="flex-1 h-2 bg-black/50 rounded overflow-hidden border border-white/30">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${myRatio * 100}%` }}
          />
        </div>
        <div className="text-[10px] font-mono w-12 text-right">
          {Math.ceil(myHp)}
        </div>
      </div>
    </div>
  );
}
