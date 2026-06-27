// マップ座標系は「メートル」を採用 (内部単位)
// PIXELS_PER_METER で画面ピクセルに変換
import type { Lane } from "@/types/common";

export const PIXELS_PER_METER = 28;

// マップサイズ (m)
export const MAP_WIDTH = 24;
export const MAP_HEIGHT = 60;

// レーンX座標 (中央が0としたいが、原点は左上)
export const LANE_X: Record<Lane, number> = {
  left: MAP_WIDTH * 0.2,
  center: MAP_WIDTH * 0.5,
  right: MAP_WIDTH * 0.8,
};

// 本陣Y座標 (敵=上, 自=下)
export const ENEMY_BASE_Y = MAP_HEIGHT * 0.08;
export const ALLY_BASE_Y = MAP_HEIGHT * 0.92;

// 本陣範囲半径
export const BASE_RADIUS = 6;

// レーン変更可能帯 (中央付近のY範囲)
export const LANE_SWITCH_Y_MIN = MAP_HEIGHT * 0.4;
export const LANE_SWITCH_Y_MAX = MAP_HEIGHT * 0.6;

export function metersToPx(m: number): number {
  return m * PIXELS_PER_METER;
}
