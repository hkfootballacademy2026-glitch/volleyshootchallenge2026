import { Ball, GameSessionState } from "../game/types";

export interface ReplayBall {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: Ball["type"];
  fade?: number;
}

export interface ReplayFrame {
  t: number;
  balls: ReplayBall[];
  score: number;
  hits: number;
  timeRemaining: number;
}

export interface VideoReplay {
  uri: string;
  durationMs: number;
  recordedAt: string;
  frames?: ReplayFrame[];
}

let lastReplay: VideoReplay | null = null;
let pendingFrames: ReplayFrame[] = [];

export function resetReplayTimeline() {
  pendingFrames = [];
}

export function appendReplayFrame(t: number, balls: Ball[], session: GameSessionState, timeRemaining: number) {
  if (pendingFrames.length > 900) pendingFrames.shift();
  pendingFrames.push({
    t,
    score: session.score,
    hits: session.hits,
    timeRemaining,
    balls: balls.map((ball) => ({
      id: ball.id,
      x: ball.x,
      y: ball.y,
      radius: ball.radius,
      type: ball.type,
      fade: ball.fade,
    })),
  });
}

export function saveVideoReplay(replay: Omit<VideoReplay, "frames"> | VideoReplay | null) {
  if (!replay) {
    lastReplay = null;
    resetReplayTimeline();
    return;
  }
  lastReplay = { ...replay, frames: pendingFrames };
}

export function getVideoReplay() {
  return lastReplay;
}

export function hasVideoReplay() {
  return lastReplay !== null;
}