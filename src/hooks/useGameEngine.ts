import { useRef, useState, useCallback, useEffect } from "react";
import { Difficulty, GameMode, DIFFICULTY_CONFIG, BALL_TYPE_CONFIG } from "../game/constants";
import { Ball, FootPoint, GameSessionState, createInitialSession } from "../game/types";
import { spawnBall, stepBall, isBallOut, resetBallIdCounter } from "../game/physics";
import { checkKick, calcKickScore, calcBlackPenalty, calcBlackThroughBonus } from "../game/kickDetection";
import { resolveShotVector, goalGeometry, resolveShotOutcome, rerollTarget } from "../game/goalTarget";
import { DetectedFeet } from "./usePoseDetection";

export type PopupEvent = { id: number; x: number; y: number; text: string; sub?: string; color: string; bornAt: number };

interface UseGameEngineArgs {
  mode: GameMode;
  difficulty: Difficulty;
  screenW: number;
  screenH: number;
  feet: DetectedFeet;
  onGameEnd: (session: GameSessionState) => void;
}

/**
 * 60fps相当のゲームループ。requestAnimationFrame(RN環境ではglobal.requestAnimationFrame)で駆動する。
 * Web版(volleyshoot-game.html)のメインループと同じ構造を保っている。
 */
export function useGameEngine({ mode, difficulty, screenW, screenH, feet, onGameEnd }: UseGameEngineArgs) {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [popups, setPopups] = useState<PopupEvent[]>([]);
  const [session, setSession] = useState<GameSessionState>(createInitialSession());
  const [timeRemaining, setTimeRemaining] = useState(DIFFICULTY_CONFIG[difficulty].timeLimit);
  const [targetZone, setTargetZone] = useState(0);
  const [running, setRunning] = useState(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const ballsRef = useRef<Ball[]>([]);
  ballsRef.current = balls;
  const feetRef = useRef(feet);
  feetRef.current = feet;
  const lastSpawnRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef(0);
  const popupIdRef = useRef(0);

  const geom = goalGeometry(screenW, screenH, difficulty);

  const pushPopup = useCallback((x: number, y: number, text: string, color: string, sub?: string) => {
    const id = popupIdRef.current++;
    const bornAt = Date.now();
    setPopups((prev) => [...prev, { id, x, y, text, sub, color, bornAt }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1000);
  }, []);

  const start = useCallback(() => {
    resetBallIdCounter();
    setBalls([]);
    setPopups([]);
    setSession(createInitialSession());
    setTimeRemaining(DIFFICULTY_CONFIG[difficulty].timeLimit);
    setTargetZone(Math.floor(Math.random() * geom.cols * geom.rows));
    lastSpawnRef.current = Date.now() + 600 - DIFFICULTY_CONFIG[difficulty].spawnInterval;
    setRunning(true);
  }, [difficulty, geom.cols, geom.rows]);

  // タイマー
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          clearInterval(iv);
          setRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (!running && timeRemaining === 0) {
      onGameEnd(sessionRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timeRemaining]);

  // メインループ
  useEffect(() => {
    if (!running) return;

    const loop = (nowMs: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - (lastFrameTsRef.current || nowMs)) / 1000);
      lastFrameTsRef.current = nowMs;

      const cfg = DIFFICULTY_CONFIG[difficulty];
      let currentBalls = [...ballsRef.current];

      // 1. スポーン
      if (Date.now() - lastSpawnRef.current >= cfg.spawnInterval) {
        lastSpawnRef.current = Date.now();
        const newBall = spawnBall({
          screenW, screenH, difficulty, gameMode: mode,
          leftFoot: feetRef.current.left, rightFoot: feetRef.current.right,
        });
        currentBalls.push(newBall);
        if (newBall.type !== "BLACK") {
          setSession((s) => ({ ...s, totalBalls: s.totalBalls + 1 }));
        }
      }

      // 2. 物理更新
      for (const b of currentBalls) {
        if (b.shotPending && mode === "TARGET" && b.kicked) {
          const prevY = b.y;
          stepBall(b, dt, difficulty, screenW, screenH, nowMs);
          const lineY = geom.gy + geom.gh;
          if (prevY > lineY && b.y <= lineY) {
            b.shotPending = false;
            resolveShot(b, nowMs);
          }
        } else {
          stepBall(b, dt, difficulty, screenW, screenH, nowMs);
        }
      }

      // 3. 当たり判定(未キックのボールのみ)
      const hitFeet: FootPoint[] = [feetRef.current.left, feetRef.current.right].filter(Boolean) as FootPoint[];
      if (hitFeet.length > 0) {
        for (const b of currentBalls) {
          if (b.kicked || !b.active) continue;
          for (const f of hitFeet) {
            const result = checkKick(b, f, difficulty);
            if (result.kind === "miss") continue;

            if (result.kind === "touch") {
              if (!b.touchHinted) {
                b.touchHinted = true;
                pushPopup(b.x, b.y - 20, "タッチ…", "#9AA3B8", "足を振って蹴ろう!");
              }
            } else if (result.kind === "black_safe") {
              if (!b.touchHinted) {
                b.touchHinted = true;
                pushPopup(b.x, b.y - 20, "セーフ!", "#7CFC9A", "蹴らなければ平気");
              }
            } else if (result.kind === "black_kick") {
              const penalty = calcBlackPenalty(difficulty);
              b.kicked = true; b.active = false;
              b.kickedVx = (Math.random() - 0.5) * 500;
              b.kickedVy = -(600 + Math.random() * 300);
              setSession((s) => ({ ...s, score: Math.max(0, s.score - penalty), penaltyCount: s.penaltyCount + 1, combo: 0 }));
              pushPopup(b.x, b.y - 20, `-${penalty}`, "#FF4757", "ペナルティ!");
            } else if (result.kind === "kick") {
              if (mode === "TARGET") {
                const shot = resolveShotVector(b, f);
                b.kicked = true; b.active = false; b.shotPending = true;
                b.shotPerfect = result.perfect;
                b.shotGrounded = shot.grounded;
                b.kickedVx = shot.vx; b.kickedVy = shot.vy;
              } else {
                b.kicked = true; b.active = false;
                const pts = calcKickScore(b.type, result.perfect, sessionRef.current.combo, difficulty);
                b.kickedVx = (b.x < screenW / 2 ? 1 : -1) * (500 + Math.random() * 400);
                b.kickedVy = -(1400 + Math.random() * 500);
                setSession((s) => {
                  const combo = s.combo + 1;
                  return {
                    ...s,
                    score: s.score + pts,
                    hits: s.hits + 1,
                    combo,
                    maxCombo: Math.max(s.maxCombo, combo),
                    perfectCount: s.perfectCount + (result.perfect ? 1 : 0),
                    leftHits: s.leftHits + (f.side === "L" ? 1 : 0),
                    rightHits: s.rightHits + (f.side === "R" ? 1 : 0),
                    reactionTimes: b.ringAt ? [...s.reactionTimes, Math.max(0, nowMs - b.ringAt)] : s.reactionTimes,
                  };
                });
                pushPopup(b.x, b.y - 20, `+${pts}`, result.perfect ? "#FFC53D" : "#F5F8FF", result.perfect ? "PERFECT!" : undefined);
              }
            }
            break;
          }
        }
      }

      // 4. 枠外除去 + 黒スルーボーナス/コンボ切れ
      const survivors: Ball[] = [];
      for (const b of currentBalls) {
        const out = isBallOut(b, screenW, screenH);
        if (out) {
          if (!b.kicked && b.active) {
            if (b.type === "BLACK") {
              const bonus = calcBlackThroughBonus(difficulty);
              setSession((s) => ({ ...s, score: s.score + bonus }));
              pushPopup(Math.max(60, Math.min(screenW - 60, b.x)), Math.max(120, Math.min(screenH - 120, b.y)), `+${bonus}`, "#7CFC9A", "ナイススルー!");
            } else if (mode !== "TARGET") {
              setSession((s) => ({ ...s, combo: 0 }));
            }
          } else if (mode === "TARGET" && b.kicked && b.shotPending) {
            onShotMiss(b);
          }
          continue;
        }
        survivors.push(b);
      }
      ballsRef.current = survivors;
      setBalls(survivors);

      function resolveShot(ball: Ball, t: number) {
        const outcome = resolveShotOutcome(ball, geom, targetZone);
        const cfg2 = DIFFICULTY_CONFIG[difficulty];
        if (outcome.kind === "miss") {
          onShotMiss(ball);
          return;
        }
        const base = outcome.kind === "goal" ? 30 : 10;
        const combo = sessionRef.current.combo;
        const comboBonus = outcome.kind === "goal" ? combo * 5 : 0;
        const pts = Math.round(base * cfg2.multiplier * (ball.shotPerfect ? 1.5 : 1) + comboBonus);
        if (outcome.kind === "goal") {
          setSession((s) => {
            const newCombo = s.combo + 1;
            return {
              ...s, score: s.score + pts, hits: s.hits + 1, combo: newCombo,
              maxCombo: Math.max(s.maxCombo, newCombo),
              perfectCount: s.perfectCount + (ball.shotPerfect ? 1 : 0),
              goalOnTarget: s.goalOnTarget + 1,
            };
          });
          setTargetZone((z) => rerollTarget(z, geom.cols, geom.rows));
          pushPopup(ball.x, ball.y + 30, `+${pts}`, "#FFC53D", "ゴール!!");
        } else {
          setSession((s) => ({ ...s, score: s.score + pts, goalFrameIn: s.goalFrameIn + 1, combo: 0 }));
          pushPopup(ball.x, ball.y + 30, `+${pts}`, "#3B9CFF", "枠内");
        }
      }
      function onShotMiss(ball: Ball) {
        setSession((s) => ({ ...s, combo: 0 }));
        pushPopup(ball.x, Math.max(140, ball.y), "0", "#9AA3B8", ball.shotGrounded ? "浮かせよう!" : "枠外!");
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, difficulty, screenW, screenH, geom.cols, geom.rows]);

  return { balls, popups, session, timeRemaining, targetZone, geom, start };
}
