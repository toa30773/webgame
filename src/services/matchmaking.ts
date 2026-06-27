import { signInAnonymous } from "@/services/auth";
import {
  openRoomChannel,
  waitForOpponent,
  type NetSession,
} from "@/services/net";

// 部屋セッションを useNetSession で取り回すためのモジュールローカル管理
let activeSession: NetSession | null = null;

export function getActiveSession(): NetSession | null {
  return activeSession;
}

export async function closeActiveSession(): Promise<void> {
  if (activeSession) {
    try {
      activeSession.send({ type: "leave", from: activeSession.role });
    } catch {
      /* noop */
    }
    await activeSession.close();
    activeSession = null;
  }
}

function makeRoomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * 部屋を作成しゲストを待機。ゲストが来たらonOpponentJoined(true)を呼ぶ。
 */
export async function createRoom(
  onOpponentJoined: (joined: boolean) => void
): Promise<string> {
  await signInAnonymous();
  await closeActiveSession();
  const code = makeRoomCode();
  const session = await openRoomChannel(code, "host");
  activeSession = session;
  // 別タスクで対戦相手の参加を待つ
  void waitForOpponent(session, 120_000)
    .then(() => onOpponentJoined(true))
    .catch(() => onOpponentJoined(false));
  return code;
}

export async function joinRoom(code: string): Promise<void> {
  await signInAnonymous();
  await closeActiveSession();
  const session = await openRoomChannel(code, "guest");
  activeSession = session;
  // ホスト側が存在するか確認
  try {
    await waitForOpponent(session, 5000);
  } catch {
    await closeActiveSession();
    throw new Error("部屋が見つかりません or ホストが居ません");
  }
}

