import { useGameStore } from "@/store/gameStore";

export function haptic(pattern: number | number[]): void {
  if (!useGameStore.getState().hapticsEnabled) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // 一部ブラウザで例外発生する可能性
  }
}

export const Haptics = {
  light: (): void => haptic(8),
  medium: (): void => haptic(18),
  heavy: (): void => haptic(40),
  hit: (): void => haptic([10, 30, 10]),
};
