import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { closeActiveSession } from "@/services/matchmaking";

export function ResultPage(): JSX.Element {
  const status = useGameStore((s) => s.status);
  const setView = useSessionStore((s) => s.setView);
  const battleMode = useSessionStore((s) => s.battleMode);
  const setBattleMode = useSessionStore((s) => s.setBattleMode);
  const win = status === "victory";

  // オンライン対戦終了時はセッションを閉じる
  useEffect(() => {
    if (battleMode.kind !== "ai") {
      void closeActiveSession();
    }
  }, [battleMode.kind]);

  const backToTitle = (): void => {
    setBattleMode({ kind: "ai" });
    setView("title");
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 pointer-events-auto safe-top safe-bottom">
      <div
        className={`text-6xl font-extrabold tracking-widest ${
          win ? "text-amber-300" : "text-red-400"
        }`}
      >
        {win ? "勝利" : "敗北"}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {battleMode.kind === "ai" && (
          <button
            type="button"
            onClick={() => setView("battle")}
            className="py-3 rounded-xl bg-amber-500 text-slate-900 font-bold shadow"
          >
            もう一度
          </button>
        )}
        <button
          type="button"
          onClick={backToTitle}
          className="py-3 rounded-xl bg-slate-800 text-white font-bold border border-white/30"
        >
          タイトルへ
        </button>
      </div>
    </div>
  );
}
