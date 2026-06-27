import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { closeActiveSession } from "@/services/matchmaking";

export function PauseOverlay(): JSX.Element | null {
  const paused = useGameStore((s) => s.paused);
  const status = useGameStore((s) => s.status);
  const setPaused = useGameStore((s) => s.setPaused);
  const setStatus = useGameStore((s) => s.setStatus);
  const haptics = useGameStore((s) => s.hapticsEnabled);
  const setHaptics = useGameStore((s) => s.setHapticsEnabled);
  const sfx = useGameStore((s) => s.sfxEnabled);
  const setSfx = useGameStore((s) => s.setSfxEnabled);
  const battleMode = useSessionStore((s) => s.battleMode);
  const setBattleMode = useSessionStore((s) => s.setBattleMode);
  const setView = useSessionStore((s) => s.setView);
  const isOnline = battleMode.kind !== "ai";

  if (!paused || status !== "playing") return null;

  const handleClose = (): void => setPaused(false);

  const handleResign = (): void => {
    // 自分の敗北として終了 (closeActiveSession内でleaveメッセージ送信)
    if (isOnline) {
      void closeActiveSession();
    }
    setStatus("defeat");
    setPaused(false);
    // BattlePage の useEffect で result 画面に遷移
  };

  const handleQuitToTitle = (): void => {
    setStatus("defeat");
    setPaused(false);
    setBattleMode({ kind: "ai" });
    setView("title");
  };

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto">
      <div className="flex flex-col items-center gap-3 px-8 py-6 bg-slate-900/90 border border-white/20 rounded-xl min-w-[240px]">
        <div className="text-2xl font-bold text-amber-300">
          {isOnline ? "メニュー" : "一時停止"}
        </div>
        {isOnline && (
          <div className="text-[10px] text-white/60 -mt-2">
            オンライン対戦中は時間は止まりません
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sfx}
            onChange={(e) => setSfx(e.target.checked)}
          />
          <span>効果音</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={haptics}
            onChange={(e) => setHaptics(e.target.checked)}
          />
          <span>振動 (バイブ)</span>
        </label>
        <button
          type="button"
          onClick={handleClose}
          className="w-full mt-1 px-6 py-2 bg-amber-400 text-slate-900 rounded font-bold"
        >
          {isOnline ? "戻る" : "再開"}
        </button>
        {isOnline ? (
          <button
            type="button"
            onClick={handleResign}
            className="w-full px-6 py-2 bg-red-600 text-white rounded font-bold"
          >
            降参
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuitToTitle}
            className="w-full px-6 py-2 bg-slate-700 text-white border border-white/30 rounded font-bold"
          >
            タイトルへ
          </button>
        )}
      </div>
    </div>
  );
}
