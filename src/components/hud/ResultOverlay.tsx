import { useGameStore } from "@/store/gameStore";

export function ResultOverlay(): JSX.Element | null {
  const status = useGameStore((s) => s.status);
  if (status === "playing") return null;
  const win = status === "victory";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="flex flex-col items-center gap-4">
        <div
          className={`text-5xl font-extrabold tracking-widest ${
            win ? "text-amber-300" : "text-red-400"
          }`}
        >
          {win ? "勝利" : "敗北"}
        </div>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-2 px-4 py-2 bg-white text-slate-900 rounded font-bold"
        >
          再戦
        </button>
      </div>
    </div>
  );
}
