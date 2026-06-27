import { useSessionStore } from "@/store/sessionStore";
import {
  GENERAL_CATALOG,
  type GeneralId,
} from "@/game/generals/generalsCatalog";

const ORDER: GeneralId[] = ["warrior", "bulwark", "skirmisher", "tactician"];

export function GeneralSelectPage(): JSX.Element {
  const myGeneral = useSessionStore((s) => s.myGeneral);
  const setMyGeneral = useSessionStore((s) => s.setMyGeneral);
  const setView = useSessionStore((s) => s.setView);
  const pendingMode = useSessionStore((s) => s.pendingMode);
  const setBattleMode = useSessionStore((s) => s.setBattleMode);
  const setPendingMode = useSessionStore((s) => s.setPendingMode);

  const startBattle = (): void => {
    if (pendingMode) {
      setBattleMode(pendingMode);
      setPendingMode(null);
      if (pendingMode.kind === "ai") {
        setView("battle");
      } else {
        // オンライン: ロビーへ
        setView("lobby");
      }
    } else {
      setBattleMode({ kind: "ai" });
      setView("battle");
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 pointer-events-auto safe-top safe-bottom">
      <div className="text-xl font-bold text-amber-300">将軍を選択</div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {ORDER.map((id) => {
          const g = GENERAL_CATALOG[id];
          const selected = myGeneral === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMyGeneral(id)}
              className={`text-left rounded-xl p-3 border-2 ${
                selected
                  ? "bg-amber-600/30 border-amber-300 shadow-[0_0_12px_2px_rgba(252,211,77,0.5)]"
                  : "bg-slate-800/80 border-white/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    selected ? "bg-amber-500" : "bg-blue-500"
                  }`}
                >
                  {g.symbol}
                </div>
                <div className="font-bold">{g.name}</div>
              </div>
              <div className="text-[10px] text-white/80 mt-1">
                {g.description}
              </div>
              <div className="text-[10px] mt-2 grid grid-cols-3 gap-1 text-white/70">
                <span>HP {g.stats.hp}</span>
                <span>速 {g.stats.speed.toFixed(1)}</span>
                <span>攻 {g.stats.attackDamage}</span>
              </div>
              <div className="text-[10px] mt-1 text-amber-200">
                ★ {g.unique.label}: {g.unique.description}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1">
        <button
          type="button"
          onClick={() => setView("title")}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white/80 border border-white/20"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={startBattle}
          className="px-6 py-2 rounded-lg bg-amber-500 text-slate-900 font-bold"
        >
          決定
        </button>
      </div>
    </div>
  );
}
