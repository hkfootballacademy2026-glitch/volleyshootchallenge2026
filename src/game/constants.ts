// ゲーム全体の定数。Web版(volleyshoot-game.html)のロジックを正としてTypeScript化。
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type GameMode = "VOLLEY" | "TARGET";
export type BallKind = "SIDE" | "FRONT";
export type BallType = "NORMAL" | "BLUE" | "GOLD" | "BLACK";

export interface DifficultyConfig {
  timeLimit: number;
  spawnInterval: number;
  speedMin: number;
  speedMax: number;
  gravity: number;
  hitRadius: number; // MoveNetはつま先非検出のため1.2倍補正込み
  blueRate: number;
  goldRate: number;
  blackRate: number;
  multiplier: number;
  ballScale: number;
  frontRate: number;
}

// hitRadius は Web版(足首+つま先+かかとの加重平均)の値に、
// MoveNet(足首のみ検出)向けの補正 ×1.2 を掛けてある
export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  EASY: {
    timeLimit: 60, spawnInterval: 2300, speedMin: 0.42, speedMax: 0.58,
    gravity: 0.62, hitRadius: 78 * 1.2, blueRate: 0.0, goldRate: 0.08,
    blackRate: 0.06, multiplier: 1.0, ballScale: 1.25, frontRate: 0.35,
  },
  NORMAL: {
    timeLimit: 60, spawnInterval: 1750, speedMin: 0.52, speedMax: 0.72,
    gravity: 0.72, hitRadius: 62 * 1.2, blueRate: 0.12, goldRate: 0.08,
    blackRate: 0.12, multiplier: 1.5, ballScale: 1.0, frontRate: 0.45,
  },
  HARD: {
    timeLimit: 45, spawnInterval: 1300, speedMin: 0.62, speedMax: 0.88,
    gravity: 0.82, hitRadius: 50 * 1.2, blueRate: 0.2, goldRate: 0.1,
    blackRate: 0.16, multiplier: 2.0, ballScale: 0.8, frontRate: 0.5,
  },
};

export interface BallTypeConfig {
  points: number;
  color: string;
}

export const BALL_TYPE_CONFIG: Record<BallType, BallTypeConfig> = {
  NORMAL: { points: 10, color: "#F5F8FF" },
  BLUE: { points: 20, color: "#3B9CFF" },
  GOLD: { points: 30, color: "#FFC53D" },
  BLACK: { points: -20, color: "#1A1A22" },
};

// キック判定の閾値(px/s)。Web版と同一。
export const KICK_MIN_SPEED = 320;
export const PERFECT_FOOT_SPEED = 900;
// 正面ボレーは足が奥行き方向に動き画面上の移動量が小さくなるため閾値を緩和
export const FRONT_KICK_RELIEF = 0.45;
export const FRONT_PERFECT_RELIEF = 0.6;

// 正面ボールのキック可能窓(進行度 0-1)
export const FRONT_KICK_MIN_P = 0.76;
export const FRONT_KICK_MAX_P = 1.1;

// ゴールターゲット: シュート方向ブレンドの重み
export const SHOT_WEIGHT_CONTACT = 0.58;
export const SHOT_WEIGHT_SWING = 0.27;
export const SHOT_WEIGHT_REFLECT = 0.15;

export const MODE_META: Record<GameMode, { title: string; desc: string }> = {
  VOLLEY: { title: "ミートシュート", desc: "飛んでくるボールを正確にミートしてスコアを競う" },
  TARGET: { title: "ゴールターゲット", desc: "光ったコースを狙って蹴り分ける、シュート精度のトレーニング" },
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "イージー",
  NORMAL: "ノーマル",
  HARD: "ハード",
};
