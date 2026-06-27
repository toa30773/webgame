import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { isOnlineConfigured } from "@/services/supabase";
import { signInAnonymous } from "@/services/auth";

export function TitlePage(): JSX.Element {
  const setView = useSessionStore((s) => s.setView);
  const setPendingMode = useSessionStore((s) => s.setPendingMode);
  const userId = useSessionStore((s) => s.userId);
  const setUserId = useSessionStore((s) => s.setUserId);
  const setNetError = useSessionStore((s) => s.setNetError);
  const [signingIn, setSigningIn] = useState(false);

  const online = isOnlineConfigured();

  useEffect(() => {
    if (!online || userId) return;
    setSigningIn(true);
    signInAnonymous()
      .then((id) => {
        setUserId(id);
        setNetError(null);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setNetError(msg);
      })
      .finally(() => setSigningIn(false));
  }, [online, userId, setUserId, setNetError]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 pointer-events-auto safe-top safe-bottom">
      <div className="text-center">
        <div className="text-5xl font-extrabold tracking-widest text-amber-300">
          戦将
        </div>
        <div className="text-xs text-white/70 mt-1">SenSho</div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => {
            setPendingMode({ kind: "ai" });
            setView("select");
          }}
          className="py-3 rounded-xl bg-amber-500 text-slate-900 font-bold shadow"
        >
          練習（AI対戦）
        </button>
        <button
          type="button"
          disabled={!online || !userId}
          onClick={() => {
            // 仮の pending、ロビーで上書きされる
            setPendingMode({ kind: "host", roomCode: "" });
            setView("select");
          }}
          className={`py-3 rounded-xl font-bold shadow border ${
            online && userId
              ? "bg-slate-800 text-white border-white/30"
              : "bg-slate-800/40 text-white/40 border-white/10"
          }`}
        >
          フレンド対戦
        </button>
      </div>

      <div className="text-[11px] text-white/60 text-center min-h-[20px]">
        {!online
          ? ".envにSupabase URL/KEYを設定するとオンライン対戦が有効になります"
          : signingIn
          ? "サインイン中..."
          : userId
          ? "オンライン接続OK"
          : "サインイン失敗"}
      </div>
    </div>
  );
}
