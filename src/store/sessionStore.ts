import { create } from "zustand";
import {
  DEFAULT_GENERAL_ID,
  type GeneralId,
} from "@/game/generals/generalsCatalog";

export type AppView = "title" | "select" | "lobby" | "battle" | "result";
export type BattleMode =
  | { kind: "ai" }
  | { kind: "host"; roomCode: string }
  | { kind: "guest"; roomCode: string }
  | { kind: "spectator"; roomCode: string };

interface SessionStore {
  userId: string | null;
  view: AppView;
  battleMode: BattleMode;
  myGeneral: GeneralId;
  /** 直前の対戦先 (タイトル戻ったあと再戦するとき復元) */
  pendingMode: BattleMode | null;
  pingMs: number;
  netError: string | null;
  setUserId: (id: string | null) => void;
  setView: (v: AppView) => void;
  setBattleMode: (m: BattleMode) => void;
  setMyGeneral: (g: GeneralId) => void;
  setPendingMode: (m: BattleMode | null) => void;
  setPingMs: (p: number) => void;
  setNetError: (e: string | null) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  userId: null,
  view: "title",
  battleMode: { kind: "ai" },
  myGeneral: DEFAULT_GENERAL_ID,
  pendingMode: null,
  pingMs: 0,
  netError: null,
  setUserId: (id) => set({ userId: id }),
  setView: (v) => set({ view: v }),
  setBattleMode: (m) => set({ battleMode: m }),
  setMyGeneral: (g) => set({ myGeneral: g }),
  setPendingMode: (m) => set({ pendingMode: m }),
  setPingMs: (p) => set({ pingMs: p }),
  setNetError: (e) => set({ netError: e }),
}));
