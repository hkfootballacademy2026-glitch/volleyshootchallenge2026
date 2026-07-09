import { BallType, BallKind, Difficulty } from "./constants";

export interface FootPoint {
  x: number;
  y: number;
  speed: number;
  velX: number;
  velY: number;
  side: "L" | "R";
  hitRadiusScale?: number;
}

export interface Ball {
  id: number;
  kind: BallKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: BallType;
  active: boolean;
  kicked: boolean;
  kickedVx: number;
  kickedVy: number;
  touchHinted: boolean;
  fade: number;
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  p?: number;
  flightTime?: number;
  fullRadius?: number;
  instVx?: number;
  instVy?: number;
  ringAt?: number;
  shotPending?: boolean;
  shotPerfect?: boolean;
  shotGrounded?: boolean;
  curveAx?: number;
  netCaught?: boolean;
  netCaughtAt?: number;
}

export interface GameSessionState {
  score: number;
  hits: number;
  totalBalls: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  penaltyCount: number;
  faultCount: number;
  leftHits: number;
  rightHits: number;
  reactionTimes: number[];
  goalOnTarget: number;
  goalFrameIn: number;
  targetZone: number;
}

export function createInitialSession(): GameSessionState {
  return {
    score: 0, hits: 0, totalBalls: 0, combo: 0, maxCombo: 0, perfectCount: 0,
    penaltyCount: 0, faultCount: 0, leftHits: 0, rightHits: 0, reactionTimes: [],
    goalOnTarget: 0, goalFrameIn: 0, targetZone: 0,
  };
}

export interface ScoreHistoryEntry {
  score: number;
  date: string;
}
