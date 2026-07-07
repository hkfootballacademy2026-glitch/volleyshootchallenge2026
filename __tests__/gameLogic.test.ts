import { describe, it, expect, beforeEach } from "vitest";
import { spawnBall, stepBall, isBallOut, isFrontKickable, resetBallIdCounter, generateFrontBall, generateSideBall } from "../src/game/physics";
import { checkKick, calcKickScore, calcBlackPenalty, calcBlackThroughBonus, calcRank, calcFootVelocity } from "../src/game/kickDetection";
import { resolveShotVector, goalGeometry, resolveShotOutcome, rerollTarget } from "../src/game/goalTarget";
import { FootPoint, Ball } from "../src/game/types";
import { KICK_MIN_SPEED, PERFECT_FOOT_SPEED } from "../src/game/constants";

const SCREEN_W = 400, SCREEN_H = 800;

function mkFoot(x: number, y: number, speed: number, velX = 0, velY = -speed, side: "L" | "R" = "L"): FootPoint {
  return { x, y, speed, velX, velY, side };
}

beforeEach(() => resetBallIdCounter());

describe("physics: ボール生成", () => {
  it("左右のボールが画面外(左端 or 右端)から出現する", () => {
    for (let i = 0; i < 30; i++) {
      const b = generateSideBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "NORMAL", gameMode: "VOLLEY" });
      expect(b.x === -40 || b.x === SCREEN_W + 40).toBe(true);
      expect(b.kind).toBe("SIDE");
    }
  });

  it("正面ボールは画面上部中央付近に小さく出現する", () => {
    const b = generateFrontBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "NORMAL", gameMode: "VOLLEY" });
    expect(b.kind).toBe("FRONT");
    expect(b.y).toBeLessThan(SCREEN_H * 0.4);
    expect(b.radius).toBeLessThan((b.fullRadius ?? 0) * 0.5);
  });

  it("正面ボールは足元の検出位置に向かって目標を設定する", () => {
    const foot = mkFoot(120, 700, 0);
    let matched = false;
    for (let i = 0; i < 50; i++) {
      const b = generateFrontBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "NORMAL", gameMode: "VOLLEY", leftFoot: foot });
      if (b.type !== "BLACK" && Math.abs((b.targetX ?? 0) - 120) < 100) matched = true;
    }
    expect(matched).toBe(true);
  });

  it("黒い正面ボールは足元を直接狙わず横に逸らされる", () => {
    const foot = mkFoot(200, 700, 0);
    // typeを強制的にBLACKにするため大量試行して分布を見る
    let anyFarFromFoot = false;
    for (let i = 0; i < 200; i++) {
      const b = generateFrontBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "HARD", gameMode: "VOLLEY", leftFoot: foot });
      if (b.type === "BLACK" && Math.abs((b.targetX ?? 0) - 200) > 150) anyFarFromFoot = true;
    }
    expect(anyFarFromFoot).toBe(true);
  });

  it("ハード難易度はイージーよりボールが小さい", () => {
    const sizes: Record<string, number[]> = { EASY: [], HARD: [] };
    for (let i = 0; i < 40; i++) {
      sizes.EASY.push(generateSideBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "EASY", gameMode: "VOLLEY" }).radius);
      sizes.HARD.push(generateSideBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "HARD", gameMode: "VOLLEY" }).radius);
    }
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(avg(sizes.EASY)).toBeGreaterThan(avg(sizes.HARD));
  });
});

describe("physics: ボールの運動と滞空", () => {
  it("左右ボールは重力を受けて放物線を描き、画面内の蹴れる高さを通過する", () => {
    const b = generateSideBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "NORMAL", gameMode: "VOLLEY" });
    let enteredKickZone = false;
    const dt = 1 / 60;
    let t = 0;
    for (let i = 0; i < 300 && !isBallOut(b, SCREEN_W, SCREEN_H); i++) {
      stepBall(b, dt, "NORMAL", SCREEN_W, SCREEN_H, t * 1000);
      t += dt;
      if (b.x > 0 && b.x < SCREEN_W && b.y > SCREEN_H * 0.3 && b.y < SCREEN_H) enteredKickZone = true;
    }
    expect(enteredKickZone).toBe(true);
  });

  it("正面ボールは進行度0.76〜1.1でのみキック可能になる", () => {
    const b = generateFrontBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "NORMAL", gameMode: "VOLLEY" });
    b.p = 0.5;
    expect(isFrontKickable(b)).toBe(false);
    b.p = 0.9;
    expect(isFrontKickable(b)).toBe(true);
    b.p = 1.2;
    expect(isFrontKickable(b)).toBe(false);
  });

  it("正面ボールは近づくほど大きくなる(奥行き表現)", () => {
    const b = generateFrontBall({ screenW: SCREEN_W, screenH: SCREEN_H, difficulty: "NORMAL", gameMode: "VOLLEY" });
    const r0 = b.radius;
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) stepBall(b, dt, "NORMAL", SCREEN_W, SCREEN_H, i * 16);
    expect(b.radius).toBeGreaterThan(r0);
  });
});

describe("kickDetection: タッチ/キック/PERFECTの3段階", () => {
  function mkBall(overrides: Partial<Ball> = {}): Ball {
    return {
      id: 1, kind: "SIDE", x: 200, y: 400, vx: 0, vy: 0, radius: 50,
      type: "NORMAL", active: true, kicked: false, kickedVx: 0, kickedVy: 0,
      touchHinted: false, fade: 1, ...overrides,
    };
  }

  it("足の速度が閾値未満なら『タッチ』で無得点", () => {
    const ball = mkBall();
    const foot = mkFoot(200, 400, KICK_MIN_SPEED - 50);
    const result = checkKick(ball, foot, "NORMAL");
    expect(result.kind).toBe("touch");
  });

  it("足の速度が閾値以上なら『キック』成立", () => {
    const ball = mkBall();
    const foot = mkFoot(200, 400, KICK_MIN_SPEED + 200);
    const result = checkKick(ball, foot, "NORMAL");
    expect(result.kind).toBe("kick");
  });

  it("速度がPERFECT閾値以上なら perfect フラグが立つ", () => {
    const ball = mkBall();
    const foot = mkFoot(200, 400, PERFECT_FOOT_SPEED + 100);
    const result = checkKick(ball, foot, "NORMAL");
    expect(result.kind).toBe("kick");
    if (result.kind === "kick") expect(result.perfect).toBe(true);
  });

  it("遠く離れた足には反応しない", () => {
    const ball = mkBall();
    const foot = mkFoot(200 + 999, 400 + 999, 2000);
    expect(checkKick(ball, foot, "NORMAL").kind).toBe("miss");
  });

  it("正面ボールは同じ足速度でもキック窓外なら反応しない", () => {
    const ball = mkBall({ kind: "FRONT", p: 0.3 });
    const foot = mkFoot(200, 400, 2000);
    expect(checkKick(ball, foot, "NORMAL").kind).toBe("miss");
  });

  it("正面ボールは緩和された閾値でキックが成立する(奥行き移動の過小評価を補正)", () => {
    const ball = mkBall({ kind: "FRONT", p: 0.9 });
    // 通常なら閾値割れの速度でも、正面ボールなら成立する
    const marginalSpeed = KICK_MIN_SPEED * 0.5;
    const foot = mkFoot(200, 400, marginalSpeed);
    const result = checkKick(ball, foot, "NORMAL");
    expect(result.kind).toBe("kick");
  });
});

describe("kickDetection: 黒ボールの新ルール(蹴るな、静止はセーフ)", () => {
  function mkBlackBall(): Ball {
    return {
      id: 1, kind: "SIDE", x: 200, y: 400, vx: 0, vy: 0, radius: 50,
      type: "BLACK", active: true, kicked: false, kickedVx: 0, kickedVy: 0,
      touchHinted: false, fade: 1,
    };
  }

  it("静止した足に触れてもセーフ(減点なし)", () => {
    const ball = mkBlackBall();
    const foot = mkFoot(200, 400, 50); // ほぼ静止
    const result = checkKick(ball, foot, "NORMAL");
    expect(result.kind).toBe("black_safe");
  });

  it("スイングして蹴ると減点対象になる", () => {
    const ball = mkBlackBall();
    const foot = mkFoot(200, 400, 2000);
    const result = checkKick(ball, foot, "NORMAL");
    expect(result.kind).toBe("black_kick");
  });

  it("黒ボールの判定半径は通常ボールより狭い", () => {
    const cfgHitRadius = 62 * 1.2; // NORMAL
    const ballRadius = 50;
    const blackThreshold = cfgHitRadius * 0.6 + ballRadius;
    const normalThreshold = cfgHitRadius * 1.0 + ballRadius;
    const dist = (blackThreshold + normalThreshold) / 2; // 黒では外れ、通常では当たる中間距離
    const black = mkBlackBall();
    black.x = 200 + dist; black.y = 400; black.radius = ballRadius;
    const foot = mkFoot(200, 400, 2000);
    expect(checkKick(black, foot, "NORMAL").kind).toBe("miss");

    const normal: Ball = { ...black, type: "NORMAL", x: 200 + dist, y: 400, radius: ballRadius };
    expect(checkKick(normal, foot, "NORMAL").kind).toBe("kick");
  });
});

describe("kickDetection: スコア計算", () => {
  it("通常ボール・非PERFECTのスコアは 基礎点×倍率+コンボボーナス", () => {
    // NORMAL難易度の倍率は1.5, コンボ2なら+10
    const pts = calcKickScore("NORMAL", false, 2, "NORMAL");
    expect(pts).toBe(Math.round(10 * 1.5 + 2 * 5));
  });

  it("PERFECTは1.5倍加算される", () => {
    const normalPts = calcKickScore("GOLD", false, 0, "HARD");
    const perfectPts = calcKickScore("GOLD", true, 0, "HARD");
    expect(perfectPts).toBeGreaterThan(normalPts);
    expect(perfectPts).toBe(Math.round(30 * 2.0 * 1.5));
  });

  it("黒ボールの減点額は難易度倍率に比例する", () => {
    expect(calcBlackPenalty("EASY")).toBe(20);
    expect(calcBlackPenalty("HARD")).toBe(40);
  });

  it("黒ボールのスルーボーナスは減点よりずっと小さい", () => {
    expect(calcBlackThroughBonus("NORMAL")).toBeLessThan(calcBlackPenalty("NORMAL"));
  });

  it("ランク判定: 高成功率・ノーミス・高PERFECT率でS", () => {
    expect(calcRank(90, true, 0.5)).toBe("S");
    expect(calcRank(90, false, 0.5)).toBe("A"); // ミスがあるとSにならない
    expect(calcRank(50, true, 0.9)).toBe("B");
    expect(calcRank(10, true, 0.9)).toBe("C");
  });
});

describe("kickDetection: 足速度の算出", () => {
  it("前フレームがなければ速度0", () => {
    const v = calcFootVelocity(100, 100, null, 1000);
    expect(v.speed).toBe(0);
  });

  it("移動距離とフレーム間隔から正しく速度を算出する", () => {
    // 100px を 100ms で移動 = 1000px/s
    const v = calcFootVelocity(100, 0, { x: 0, y: 0, ts: 900 }, 1000);
    expect(v.speed).toBeCloseTo(1000, 0);
  });
});

describe("goalTarget: シュート方向のミートポイント支配", () => {
  function mkBall(x: number, y: number, extra: Partial<Ball> = {}): Ball {
    return {
      id: 1, kind: "SIDE", x, y, vx: 0, vy: 0, radius: 50, type: "NORMAL",
      active: true, kicked: false, kickedVx: 0, kickedVy: 0, touchHinted: false, fade: 1, ...extra,
    };
  }

  it("ボールの下を叩くと上方向へ飛ぶ", () => {
    const ball = mkBall(200, 400);
    const foot = mkFoot(200, 450, 1500, 0, -1200); // ボールの下からミート
    const shot = resolveShotVector(ball, foot);
    expect(shot.vy).toBeLessThan(0);
    expect(Math.abs(shot.vx)).toBeLessThan(Math.abs(shot.vy) * 0.6);
  });

  it("ボールの左下を叩くと右上へ飛ぶ", () => {
    const ball = mkBall(200, 400);
    const foot = mkFoot(160, 450, 1500, 150, -1200);
    const shot = resolveShotVector(ball, foot);
    expect(shot.vx).toBeGreaterThan(0);
    expect(shot.vy).toBeLessThan(0);
  });

  it("ボールの右下を叩くと左上へ飛ぶ", () => {
    const ball = mkBall(200, 400);
    const foot = mkFoot(240, 450, 1500, -150, -1200);
    const shot = resolveShotVector(ball, foot);
    expect(shot.vx).toBeLessThan(0);
    expect(shot.vy).toBeLessThan(0);
  });

  it("ボールの上にかぶせる(振り上げ不足)と grounded=true で届かない", () => {
    const ball = mkBall(200, 400);
    const foot = mkFoot(200, 350, 1500, 0, 800); // ボールの上・下向きスイング
    const shot = resolveShotVector(ball, foot);
    expect(shot.grounded).toBe(true);
  });

  it("弱いスイングは弱いシュート速度になる", () => {
    const ball = mkBall(200, 400);
    const weak = resolveShotVector(ball, mkFoot(200, 450, 400, 0, -320));
    const strong = resolveShotVector(ball, mkFoot(200, 450, 2500, 0, -2000));
    const weakSpeed = Math.hypot(weak.vx, weak.vy);
    const strongSpeed = Math.hypot(strong.vx, strong.vy);
    expect(strongSpeed).toBeGreaterThan(weakSpeed * 1.5);
  });
});

describe("goalTarget: ゴール判定とゾーン分割", () => {
  it("ノーマル/イージーは2x2、ハードは3x2に分割される", () => {
    const normal = goalGeometry(400, 800, "NORMAL");
    const hard = goalGeometry(400, 800, "HARD");
    expect(normal.cols).toBe(2);
    expect(hard.cols).toBe(3);
    expect(normal.rows).toBe(2);
    expect(hard.rows).toBe(2);
  });

  it("ターゲットゾーンに入ったシュートは goal 判定になる", () => {
    const geom = goalGeometry(400, 800, "NORMAL");
    // 左上ゾーン(col0,row0)の中心付近にシュート
    const ball: Ball = {
      id: 1, kind: "SIDE", x: geom.gx + geom.gw * 0.25, y: 0, vx: 0, vy: 0,
      radius: 20, type: "NORMAL", active: true, kicked: true,
      kickedVx: 0, kickedVy: -2000, touchHinted: false, fade: 1,
    };
    const outcome = resolveShotOutcome(ball, geom, 0);
    expect(outcome.kind).toBe("goal");
  });

  it("違うゾーンに入ると frame(枠内)判定になる", () => {
    const geom = goalGeometry(400, 800, "NORMAL");
    const ball: Ball = {
      id: 1, kind: "SIDE", x: geom.gx + geom.gw * 0.75, y: 0, vx: 0, vy: 0,
      radius: 20, type: "NORMAL", active: true, kicked: true,
      kickedVx: 0, kickedVy: -2000, touchHinted: false, fade: 1,
    };
    const outcome = resolveShotOutcome(ball, geom, 0); // ターゲットは左上だが右上に着弾
    expect(outcome.kind).toBe("frame");
  });

  it("枠外に外れると miss 判定になる", () => {
    const geom = goalGeometry(400, 800, "NORMAL");
    const ball: Ball = {
      id: 1, kind: "SIDE", x: -50, y: 0, vx: 0, vy: 0,
      radius: 20, type: "NORMAL", active: true, kicked: true,
      kickedVx: 0, kickedVy: -2000, touchHinted: false, fade: 1,
    };
    expect(resolveShotOutcome(ball, geom, 0).kind).toBe("miss");
  });

  it("的中後は同じゾーンを連続で出さない", () => {
    let zone = 0;
    for (let i = 0; i < 20; i++) {
      const next = rerollTarget(zone, 2, 2);
      expect(next).not.toBe(zone);
      zone = next;
    }
  });
});
