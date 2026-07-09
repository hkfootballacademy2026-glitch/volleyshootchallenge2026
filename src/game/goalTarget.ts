import { Difficulty, SHOT_WEIGHT_CONTACT, SHOT_WEIGHT_SWING, SHOT_WEIGHT_REFLECT } from "./constants";
import { Ball, FootPoint } from "./types";

function normalize(x: number, y: number): { x: number; y: number } | null {
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : null;
}

export function resolveShotVector(ball: Ball, foot: FootPoint): { vx: number; vy: number; grounded: boolean } {
  const contactN = normalize(ball.x - foot.x, ball.y - foot.y);
  const swingN = normalize(foot.velX, foot.velY);

  const inVx = ball.kind === "FRONT" ? ball.instVx ?? 0 : ball.vx;
  const inVy = ball.kind === "FRONT" ? ball.instVy ?? 0 : ball.vy;
  let reflectN: { x: number; y: number } | null = null;
  if (contactN) {
    const dot = inVx * contactN.x + inVy * contactN.y;
    reflectN = normalize(inVx - 2 * dot * contactN.x, inVy - 2 * dot * contactN.y);
  }

  let dx = 0;
  let dy = 0;
  if (contactN) { dx += contactN.x * SHOT_WEIGHT_CONTACT; dy += contactN.y * SHOT_WEIGHT_CONTACT; }
  if (swingN) { dx += swingN.x * SHOT_WEIGHT_SWING; dy += swingN.y * SHOT_WEIGHT_SWING; }
  if (reflectN) { dx += reflectN.x * SHOT_WEIGHT_REFLECT; dy += reflectN.y * SHOT_WEIGHT_REFLECT; }
  const dir = normalize(dx * 1000, dy * 1000) ?? swingN ?? { x: 0, y: 1 };

  const speedBoost = ball.kind === "FRONT" ? 1.6 : 1;
  const mag = Math.max(1, foot.speed * speedBoost);
  const shotSpeed = (900 + Math.min(2600, mag * 1.1)) / 2;

  const kickedVx = dir.x * shotSpeed * 0.95;
  const forwardVy = Math.max(520, Math.abs(dir.y) * shotSpeed * 0.35 + shotSpeed * 0.55);
  const grounded = foot.speed < 460;
  return { vx: kickedVx, vy: forwardVy, grounded };
}

export interface GoalGeometry {
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  cols: number;
  rows: number;
}

export function goalGeometry(screenW: number, screenH: number, difficulty: Difficulty): GoalGeometry {
  void difficulty;
  const gw = screenW * 0.8;
  const gx = (screenW - gw) / 2;
  const gy = screenH * 0.64;
  const gh = screenH * 0.22;
  return { gx, gy, gw, gh, cols: 3, rows: 1 };
}

export function zoneAtX(x: number, geom: GoalGeometry): number {
  if (x < geom.gx || x > geom.gx + geom.gw) return -1;
  return Math.min(geom.cols - 1, Math.floor((x - geom.gx) / (geom.gw / geom.cols)));
}

export type ShotOutcome =
  | { kind: "goal"; zone: number }
  | { kind: "save"; zone: number }
  | { kind: "miss" };

export function resolveShotOutcome(ball: Ball, geom: GoalGeometry, keeperZone: number): ShotOutcome {
  const zone = zoneAtX(ball.x, geom);
  if (zone < 0) return { kind: "miss" };
  return zone === keeperZone ? { kind: "save", zone } : { kind: "goal", zone };
}

export function rerollTarget(currentZone: number, cols: number, rows: number): number {
  const n = cols * rows;
  let next = Math.floor(Math.random() * n);
  if (n > 1 && next === currentZone) next = (next + 1) % n;
  return next;
}
