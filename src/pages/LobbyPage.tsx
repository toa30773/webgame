import { useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { closeActiveSession, createRoom, joinRoom } from "@/services/matchmaking";

type Mode = "menu" | "creating" | "waiting" | "joining";

export function LobbyPage(): JSX.Element {
  const setView = useSessionStore((s) => s.setView);
  const setBattleMode = useSessionStore((s) => s.setBattleMode);
  const setNetError = useSessionStore((s) => s.setNetError);
  const netError = useSessionStore((s) => s.netError);
  const [mode, setMode] = useState<Mode>("menu");
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");

  async function handleCreate(): Promise<void> {
    setMode("creating");
    setNetError(null);
    try {
      const roomCode = await createRoom((opponentJoined) => {
        if (opponentJoined) {
          setBattleMode({ kind: "host", roomCode });
          setView("battle");
        }
      });
      setCreatedCode(roomCode);
      setCode(roomCode);
      setMode("waiting");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setNetError(msg);
      setMode("menu");
    }
  }

  async function handleJoin(): Promise<void> {
    const target = joinInput.trim().toUpperCase();
    if (!target) return;
    setMode("joining");
    setNetError(null);
    try {
      await joinRoom(target);
      setBattleMode({ kind: "guest", roomCode: target });
      setView("battle");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setNetError(msg);
      setMode("menu");
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 pointer-events-auto safe-top safe-bottom">
      <div className="text-2xl font-bold text-amber-300">フレンド対戦</div>
      <div className="text-xs text-white/60 -mt-2">部屋コードで友達と対戦</div>

      {mode === "menu" && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={handleCreate}
            className="py-3 rounded-xl bg-amber-500 text-slate-900 font-bold shadow"
          >
            部屋を作成
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinInput}
              onChange={(e) =>
                setJoinInput(
                  e.target.value
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .slice(0, 6)
                    .toUpperCase()
                )
              }
              placeholder="部屋コード"
              maxLength={6}
              className="flex-1 px-3 py-3 rounded-xl bg-slate-800 text-white border border-white/30 text-center font-mono tracking-widest"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={joinInput.length < 4}
              className={`px-4 py-3 rounded-xl font-bold border ${
                joinInput.length >= 4
                  ? "bg-slate-700 text-white border-white/40"
                  : "bg-slate-800/40 text-white/40 border-white/10"
              }`}
            >
              参加
            </button>
          </div>
        </div>
      )}

      {mode === "creating" && <div className="text-white/80">部屋を作成中...</div>}
      {mode === "joining" && <div className="text-white/80">参加中...</div>}
      {mode === "waiting" && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-white/70 text-sm">この部屋コードを相手に共有</div>
          <div className="text-4xl font-mono tracking-widest text-amber-300 bg-slate-800 px-4 py-2 rounded">
            {createdCode ?? code}
          </div>
          <div className="text-white/60 text-xs">相手の参加を待っています...</div>
          <button
            type="button"
            onClick={() => {
              void closeActiveSession();
              setCreatedCode(null);
              setMode("menu");
            }}
            className="mt-2 px-4 py-2 rounded-lg bg-slate-800 text-white border border-white/30 text-sm"
          >
            キャンセル
          </button>
        </div>
      )}

      {netError && (
        <div className="text-red-300 text-xs text-center max-w-xs">
          {netError}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          void closeActiveSession();
          setView("title");
        }}
        className="mt-2 text-white/60 underline text-sm"
      >
        タイトルへ戻る
      </button>
    </div>
  );
}
