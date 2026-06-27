import { getSupabase } from "@/services/supabase";
import type { NetMessage } from "@/types/net";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSessionStore } from "@/store/sessionStore";

export type MessageHandler = (msg: NetMessage) => void;

export interface NetSession {
  channel: RealtimeChannel;
  roomCode: string;
  role: "host" | "guest";
  send: (msg: NetMessage) => void;
  close: () => Promise<void>;
  onMessage: (cb: MessageHandler) => () => void;
  onOpponentLeave: (cb: () => void) => () => void;
}

const BROADCAST_EVENT = "msg";

export async function openRoomChannel(
  roomCode: string,
  role: "host" | "guest"
): Promise<NetSession> {
  const sb = getSupabase();
  const channel = sb.channel(`room:${roomCode}`, {
    config: {
      broadcast: { ack: false, self: false },
      presence: { key: role },
    },
  });

  const handlers = new Set<MessageHandler>();
  const leaveHandlers = new Set<() => void>();
  channel.on("broadcast", { event: BROADCAST_EVENT }, (event) => {
    const msg = event.payload as NetMessage;
    for (const h of handlers) h(msg);
  });
  // 相手のpresence離脱を検知
  let opponentEverJoined = false;
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const keys = Object.keys(state);
    const hasOther = keys.some((k) => k !== role);
    if (hasOther) {
      opponentEverJoined = true;
    } else if (opponentEverJoined) {
      // 一度居た相手が消えた → 切断
      for (const cb of leaveHandlers) cb();
      opponentEverJoined = false;
    }
  });
  channel.on("presence", { event: "leave" }, () => {
    if (opponentEverJoined) {
      for (const cb of leaveHandlers) cb();
      opponentEverJoined = false;
    }
  });

  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("チャンネル接続タイムアウト"));
      }
    }, 8000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        // 自分のpresence を送信
        channel.track({ role }).catch(() => {
          /* noop */
        });
        resolve();
      } else if (
        (status === "CHANNEL_ERROR" || status === "TIMED_OUT") &&
        !resolved
      ) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`チャンネルエラー: ${status}`));
      }
    });
  });

  const session: NetSession = {
    channel,
    roomCode,
    role,
    send: (msg: NetMessage): void => {
      channel
        .send({ type: "broadcast", event: BROADCAST_EVENT, payload: msg })
        .catch((e: unknown) => {
          const err = e instanceof Error ? e.message : String(e);
          useSessionStore.getState().setNetError(err);
        });
    },
    close: async (): Promise<void> => {
      handlers.clear();
      leaveHandlers.clear();
      await sb.removeChannel(channel);
    },
    onMessage: (cb: MessageHandler): (() => void) => {
      handlers.add(cb);
      return () => handlers.delete(cb);
    },
    onOpponentLeave: (cb: () => void): (() => void) => {
      leaveHandlers.add(cb);
      return () => leaveHandlers.delete(cb);
    },
  };
  return session;
}

/**
 * 部屋に相手が居るか(presence)を待つ。
 * presence更新を監視し、自分以外のrole が見えたら resolve。
 */
export function waitForOpponent(
  session: NetSession,
  timeoutMs: number = 60000
): Promise<void> {
  const sb = session.channel;
  return new Promise<void>((resolve, reject) => {
    let done = false;
    let initialCheckTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (err?: Error): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (initialCheckTimer) clearTimeout(initialCheckTimer);
      // Supabase Realtime はリスナー個別 off を提供しないため、
      // done フラグで以後の check 処理をスキップする。
      // 残ったリスナーは session.close() でチャンネルごと解放される。
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error("相手参加タイムアウト")),
      timeoutMs
    );
    const check = (): void => {
      if (done) return;
      const state = sb.presenceState();
      const keys = Object.keys(state);
      const hasOther = keys.some((k) => k !== session.role);
      if (hasOther) finish();
    };
    sb.on("presence", { event: "sync" }, check);
    sb.on("presence", { event: "join" }, check);
    // 初期状態でも一度チェック
    initialCheckTimer = setTimeout(check, 200);
  });
}
