import { Difficulty, DIFFICULTY_CONFIG, SHOT_WEIGHT_CONTACT, SHOT_WEIGHT_SWING, SHOT_WEIGHT_REFLECT } from "./constants";
import { Ball, FootPoint } from "./types";

function normalize(x: number, y: number): { x: number; y: number } | null {
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : null;
}

/**
 * ボールのどこを叩いたか(ミートポイント) + 振り抜き方向 + 入射反射、
 * の3要素をブレンドしてシュート方向・威力を決定する。
 * 実サッカーの「ボールのどこを叩くかで方向が決まる」感覚を再現する。
 */
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

  let dx = 0, dy = 0;
  if (contactN) { dx += contactN.x * SHOT_WEIGHT_CONTACT; dy += contactN.y * SHOT_WEIGHT_CONTACT; }
  if (swingN) { dx += swingN.x * SHOT_WEIGHT_SWING; dy += swingN.y * SHOT_WEIGHT_SWING; }
  if (reflectN) { dx += reflectN.x * SHOT_WEIGHT_REFLECT; dy += reflectN.y * SHOT_WEIGHT_REFLECT; }
  const dir = normalize(dx * 1000, dy * 1000) ?? swingN ?? { x: 0, y: -1 };

  // 正面ボレーは画面上のスイング速度が過小評価されるため補正
  const speedBoost = ball.kind === "FRONT" ? 1.6 : 1;
  const mag = Math.max(1, foot.speed * speedBoost);
  const shotSpeed = (900 + Math.min(2600, mag * 1.1)) / 2;

  let kickedVx = dir.x * shotSpeed * 0.75;
  let kickedVy = dir.y * shotSpeed;
  let grounded = false;
  if (kickedVy > -100) {
    // ボールの上を叩いた/振り上げ不足 → ゴールに届かない(叩きつけ)
    kickedVy = 150;
    grounded = true;
  }
  return { vx: kickedVx, vy: kickedVy, grounded };
}

export interface GoalGeometry {
  gx: number; gy: number; gw: number; gh: number; cols: number; rows: number;
}

export function goalGeometry(screenW: number, screenH: number, difficulty: Difficulty): GoalGeometry {
  const gx = screenW * 0.14, gw = screenW * 0.72;
  const gy = screenH * 0.055, gh = screenH * 0.175;
  const cols = difficulty === "HARD" ? 3 : 2;
  const rows = 2;
  return { gx, gy, gw, gh, cols, rows };
}

export function zoneAtX(x: number, geom: GoalGeometry): number {
  if (x < geom.gx || x > geom.gx + geom.gw) return -1;
  return Math.min(geom.cols - 1, Math.floor((x - geom.gx) / (geom.gw / geom.cols)));
}

export type ShotOutcome =
  | { kind: "goal"; zone: number }
  | { kind: "frame"; zone: number }
  | { kind: "miss" };

/** シュートがゴールライン(枠の下辺)を横切った瞬間の判定 */
export function resolveShotOutcome(ball: Ball, geom: GoalGeometry, targetZone: number): ShotOutcome {
  const col = zoneAtX(ball.x, geom);
  if (col < 0) return { kind: "miss" };
  const rowThreshold = -1400;
  const row = (ball.kickedVy ?? 0) < rowThreshold ? 0 : 1; // 0=上段(鋭い振り), 1=下段
  const zone = row * geom.cols + col;
  return zone === targetZone ? { kind: "goal", zone } : { kind: "frame", zone };
}

export function rerollTarget(currentZone: number, cols: number, rows: number): number {
  const n = cols * rows;
  let next = Math.floor(Math.random() * n);
  if (n > 1 && next === currentZone) next = (next + 1) % n;
  return next;
}
