import {
  KICK_MIN_SPEED, PERFECT_FOOT_SPEED, FRONT_KICK_RELIEF, FRONT_PERFECT_RELIEF,
  DIFFICULTY_CONFIG, Difficulty, BallType, BALL_TYPE_CONFIG,
} from "./constants";
import { Ball, FootPoint } from "./types";
import { isFrontKickable } from "./physics";

export type KickResult =
  | { kind: "miss" }
  | { kind: "touch" }             // 無得点・ボール継続
  | { kind: "black_safe" }        // 静止して触れた黒ボール: セーフ
  | { kind: "black_kick" }        // スイングして蹴った黒ボール: 減点対象
  | { kind: "kick"; perfect: boolean };

/**
 * ボールと足の接触判定。VOLLEY/TARGET共通(足のみで判定)。
 */
export function checkKick(ball: Ball, foot: FootPoint, difficulty: Difficulty): KickResult {
  if (ball.kicked || !ball.active) return { kind: "miss" };
  if (ball.kind === "FRONT" && !isFrontKickable(ball)) return { kind: "miss" };

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const radiusMul = ball.type === "BLACK" ? 0.6 : 1; // 黒ボールは判定を狭く
  const dist = Math.hypot(foot.x - ball.x, foot.y - ball.y);
  const threshold = cfg.hitRadius * radiusMul + ball.radius;
  if (dist > threshold) return { kind: "miss" };

  // 正面ボレーは足が奥行き方向に動き、画面上の移動量が小さくなるため閾値を緩和
  const frontRelief = ball.kind === "FRONT" ? FRONT_KICK_RELIEF : 1;
  const swinging = foot.speed >= KICK_MIN_SPEED * frontRelief;

  if (ball.type === "BLACK") {
    return swinging ? { kind: "black_kick" } : { kind: "black_safe" };
  }
  if (!swinging) return { kind: "touch" };

  const perfectRelief = ball.kind === "FRONT" ? FRONT_PERFECT_RELIEF : 1;
  const perfect = foot.speed >= PERFECT_FOOT_SPEED * perfectRelief;
  return { kind: "kick", perfect };
}

export interface ScoreResult {
  points: number;
}

/** 通常キックのスコア計算(コンボボーナス込み) */
export function calcKickScore(ballType: BallType, perfect: boolean, combo: number, difficulty: Difficulty): number {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const base = Math.abs(BALL_TYPE_CONFIG[ballType].points);
  const comboBonus = combo * 5;
  return Math.round(base * cfg.multiplier * (perfect ? 1.5 : 1) + comboBonus);
}

/** 黒ボールを蹴ってしまった時の減点額 */
export function calcBlackPenalty(difficulty: Difficulty): number {
  return Math.round(20 * DIFFICULTY_CONFIG[difficulty].multiplier);
}

/** 黒ボールをスルー(見逃し)できた時のボーナス */
export function calcBlackThroughBonus(difficulty: Difficulty): number {
  return Math.round(5 * DIFFICULTY_CONFIG[difficulty].multiplier);
}

/** 足の速度ベクトルをフレーム間差分から計算 */
export function calcFootVelocity(
  curX: number, curY: number,
  prev: { x: number; y: number; ts: number } | null,
  nowMs: number
): { speed: number; velX: number; velY: number } {
  if (!prev) return { speed: 0, velX: 0, velY: 0 };
  const dt = Math.max(16, nowMs - prev.ts) / 1000;
  const velX = (curX - prev.x) / dt;
  const velY = (curY - prev.y) / dt;
  return { speed: Math.hypot(velX, velY), velX, velY };
}

/** 結果ランクの判定 */
export function calcRank(rate: number, clean: boolean, perfectRatio: number): "S" | "A" | "B" | "C" {
  if (rate >= 85 && clean && perfectRatio >= 0.3) return "S";
  if (rate >= 70) return "A";
  if (rate >= 45) return "B";
  return "C";
}
