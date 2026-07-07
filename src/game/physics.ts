import { DIFFICULTY_CONFIG, Difficulty, GameMode, BallType, FRONT_KICK_MIN_P, FRONT_KICK_MAX_P } from "./constants";
import { Ball, FootPoint } from "./types";

let ballIdCounter = 0;
export function resetBallIdCounter() {
  ballIdCounter = 0;
}

export function pickBallType(difficulty: Difficulty, gameMode: GameMode): BallType {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const r = Math.random();
  if (gameMode === "TARGET") {
    // ターゲットモードは狙いに集中: 黒なし
    if (r < cfg.goldRate) return "GOLD";
    if (r < cfg.goldRate + cfg.blueRate) return "BLUE";
    return "NORMAL";
  }
  if (r < cfg.blackRate) return "BLACK";
  if (r < cfg.blackRate + cfg.goldRate) return "GOLD";
  if (r < cfg.blackRate + cfg.goldRate + cfg.blueRate) return "BLUE";
  return "NORMAL";
}

const BALL_RADIUS_BASE = 26;

export interface SpawnContext {
  screenW: number;
  screenH: number;
  difficulty: Difficulty;
  gameMode: GameMode;
  leftFoot?: FootPoint | null;
  rightFoot?: FootPoint | null;
}

/** 左右から放物線で飛んでくるボールを生成する */
export function generateSideBall(ctx: SpawnContext): Ball {
  const cfg = DIFFICULTY_CONFIG[ctx.difficulty];
  const w = ctx.screenW, h = ctx.screenH;
  const fromLeft = Math.random() > 0.5;
  const type = pickBallType(ctx.difficulty, ctx.gameMode);
  const speedFactor = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
  const typeSpeed = type === "BLUE" ? 1.25 : 1;

  const startX = fromLeft ? -40 : w + 40;
  const startY = h * (0.78 + Math.random() * 0.18);
  const targetX = w * (0.3 + Math.random() * 0.4);
  const apexY = h * (0.28 + Math.random() * 0.25);

  const flightTime = (1.78 - speedFactor) / typeSpeed;
  const g = cfg.gravity * 1600;
  const vy0 = -Math.sqrt(2 * g * Math.max(60, startY - apexY));
  const vx0 = (targetX - startX) / flightTime;
  const radius = BALL_RADIUS_BASE * cfg.ballScale * (type === "GOLD" ? 0.92 : 1);

  return {
    id: ballIdCounter++, kind: "SIDE", x: startX, y: startY, vx: vx0, vy: vy0,
    radius, type, active: true, kicked: false, kickedVx: 0, kickedVy: 0,
    touchHinted: false, fade: 1,
  };
}

/** 正面から奥行きを疑似表現して飛んでくるボールを生成する */
export function generateFrontBall(ctx: SpawnContext): Ball {
  const cfg = DIFFICULTY_CONFIG[ctx.difficulty];
  const w = ctx.screenW, h = ctx.screenH;
  const type = pickBallType(ctx.difficulty, ctx.gameMode);
  const fullRadius = BALL_RADIUS_BASE * cfg.ballScale * (type === "GOLD" ? 0.92 : 1);

  let tx = w * (0.3 + Math.random() * 0.4);
  let ty = h * (0.7 + Math.random() * 0.15);
  const feetPts = [ctx.leftFoot, ctx.rightFoot].filter(Boolean) as FootPoint[];
  if (feetPts.length > 0) {
    const fp = feetPts[Math.floor(Math.random() * feetPts.length)];
    if (type === "BLACK") {
      // 黒は足元を直接狙わず横へ大きく逸らす(理不尽な回避不能を避ける)
      const dir = Math.random() > 0.5 ? 1 : -1;
      tx = Math.max(w * 0.08, Math.min(w * 0.92, fp.x + dir * (170 + Math.random() * 150)));
      ty = Math.max(h * 0.4, Math.min(h * 0.95, fp.y + (Math.random() - 0.5) * 120));
    } else {
      tx = Math.max(w * 0.15, Math.min(w * 0.85, fp.x + (Math.random() - 0.5) * 180));
      ty = Math.max(h * 0.4, Math.min(h * 0.95, fp.y));
    }
  }

  const sx = w * (0.35 + Math.random() * 0.3);
  const sy = h * (0.2 + Math.random() * 0.12);

  return {
    id: ballIdCounter++, kind: "FRONT", x: sx, y: sy, vx: 0, vy: 0,
    startX: sx, startY: sy, targetX: tx, targetY: ty,
    p: 0, flightTime: 2.1, fullRadius, radius: fullRadius * 0.32,
    type, active: true, kicked: false, kickedVx: 0, kickedVy: 0,
    touchHinted: false, fade: 1,
  };
}

export function spawnBall(ctx: SpawnContext): Ball {
  const cfg = DIFFICULTY_CONFIG[ctx.difficulty];
  if (Math.random() < cfg.frontRate) return generateFrontBall(ctx);
  return generateSideBall(ctx);
}

export function isFrontKickable(ball: Ball): boolean {
  return ball.kind === "FRONT" && (ball.p ?? 0) >= FRONT_KICK_MIN_P && (ball.p ?? 0) <= FRONT_KICK_MAX_P;
}

function easeInQuad(t: number): number {
  return t * t;
}

/**
 * 1フレーム分ボールを進める。
 * 戻り値: このフレームで枠外に出た(除去すべき)場合 true。
 */
export function stepBall(ball: Ball, dt: number, difficulty: Difficulty, screenW: number, screenH: number, nowMs: number): void {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const g = cfg.gravity * 1600;

  if (ball.kicked) {
    if (ball.curveAx) ball.kickedVx += ball.curveAx * dt;
    ball.kickedVy += g * 0.35 * dt; // シュートも重力で弧を描く(TARGETモード)
    ball.x += ball.kickedVx * dt;
    ball.y += ball.kickedVy * dt;
    return;
  }

  if (ball.kind === "FRONT") {
    const px = ball.x, py = ball.y;
    const wasKickable = isFrontKickable(ball);
    ball.p = (ball.p ?? 0) + dt / (ball.flightTime ?? 2.1);
    const pc = Math.min(1, ball.p);
    ball.x = (ball.startX ?? ball.x) + ((ball.targetX ?? ball.x) - (ball.startX ?? ball.x)) * pc;
    ball.y = (ball.startY ?? ball.y) + ((ball.targetY ?? ball.y) - (ball.startY ?? ball.y)) * easeInQuad(pc) - Math.sin(pc * Math.PI) * 40;
    ball.radius = (ball.fullRadius ?? ball.radius) * (0.32 + 0.68 * easeInQuad(pc));
    ball.instVx = (ball.x - px) / dt;
    ball.instVy = (ball.y - py) / dt;
    if (!wasKickable && isFrontKickable(ball) && !ball.ringAt) ball.ringAt = nowMs;
    if (ball.p > FRONT_KICK_MAX_P) {
      ball.fade = Math.max(0, 1 - (ball.p - FRONT_KICK_MAX_P) / 0.25);
      ball.radius = (ball.fullRadius ?? ball.radius) * (1 + (ball.p - 1) * 0.6);
    }
    return;
  }

  ball.vy += g * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}

export function isBallOut(ball: Ball, screenW: number, screenH: number): boolean {
  if (ball.kind === "FRONT" && !ball.kicked) return ball.fade <= 0;
  return ball.x < -140 || ball.x > screenW + 140 || ball.y > screenH + 140 || ball.y < -240;
}
