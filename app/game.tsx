import React, { useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, GestureResponderEvent } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { Canvas, Circle, Rect, Group } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";
import { useGameEngine } from "../src/hooks/useGameEngine";
import { Ball, FootPoint, GameSessionState } from "../src/game/types";
import type { DetectedFeet } from "../src/hooks/usePoseDetection";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MANUAL_KICK_SPEED = 1250;
const MANUAL_KICK_DURATION_MS = 180;

export default function GameScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const [feet, setFeet] = useState<DetectedFeet>({ left: null, right: null });
  const [started, setStarted] = useState(false);
  const kickReleaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handleGameEnd = useCallback(
    (session: GameSessionState) => {
      router.replace({
        pathname: "/result",
        params: {
          mode: gameMode,
          difficulty: diff,
          score: String(session.score),
          hits: String(session.hits),
          totalBalls: String(session.totalBalls),
          maxCombo: String(session.maxCombo),
          perfectCount: String(session.perfectCount),
          penaltyCount: String(session.penaltyCount),
          leftHits: String(session.leftHits),
          rightHits: String(session.rightHits),
          reactionAvg: session.reactionTimes.length
            ? String(session.reactionTimes.reduce((a, b) => a + b, 0) / session.reactionTimes.length / 1000)
            : "",
        },
      });
    },
    [router, gameMode, diff]
  );

  const engine = useGameEngine({
    mode: gameMode,
    difficulty: diff,
    screenW: SCREEN_W,
    screenH: SCREEN_H,
    feet,
    onGameEnd: handleGameEnd,
  });

  const beginCountdown = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    engine.start();
    setStarted(true);
  }, [engine]);

  const setManualKick = useCallback((event: GestureResponderEvent) => {
    if (!started) return;
    const { locationX, locationY } = event.nativeEvent;
    const side: "L" | "R" = locationX < SCREEN_W / 2 ? "L" : "R";
    const foot: FootPoint = {
      x: locationX,
      y: Math.min(SCREEN_H - 80, Math.max(SCREEN_H * 0.42, locationY)),
      speed: MANUAL_KICK_SPEED,
      velX: side === "L" ? 420 : -420,
      velY: -MANUAL_KICK_SPEED,
      side,
    };
    setFeet(side === "L" ? { left: foot, right: null } : { left: null, right: foot });
    if (kickReleaseRef.current) clearTimeout(kickReleaseRef.current);
    kickReleaseRef.current = setTimeout(() => setFeet({ left: null, right: null }), MANUAL_KICK_DURATION_MS);
  }, [started]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>カメラの許可が必要です</Text>
      </View>
    );
  }
  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>カメラデバイスが見つかりません</Text>
      </View>
    );
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => started}
      onMoveShouldSetResponder={() => started}
      onResponderGrant={setManualKick}
      onResponderMove={setManualKick}
    >
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} pixelFormat="yuv" />

      <Canvas style={StyleSheet.absoluteFill}>
        {gameMode === "TARGET" && started && <GoalOverlay geom={engine.geom} targetZone={engine.targetZone} />}
        {engine.balls.map((b) => <SoccerBall key={b.id} ball={b} />)}
        {feet.left && <FootMarker foot={feet.left} />}
        {feet.right && <FootMarker foot={feet.right} />}
      </Canvas>

      {!started ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>ゲーム中は画面下をタップ/スワイプしてキックします</Text>
          <Pressable style={styles.startBtn} onPress={beginCountdown}>
            <Text style={styles.startBtnText}>スタート</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.hud}>
            <HudCell label="SCORE" value={String(engine.session.score)} color={COLORS.gold} />
            <HudCell label="TIME" value={String(engine.timeRemaining)} color={engine.timeRemaining <= 10 ? COLORS.red : COLORS.white} />
            <HudCell label="HIT" value={String(engine.session.hits)} color={COLORS.white} />
          </View>
          <View pointerEvents="none" style={styles.kickGuide}>
            <Text style={styles.kickGuideText}>画面下をスワイプしてキック</Text>
          </View>
          {engine.popups.map((p) => (
            <View key={p.id} pointerEvents="none" style={[styles.popup, { left: p.x - 36, top: p.y - 48 }]}>
              <Text style={[styles.popupText, { color: p.color }]}>{p.text}</Text>
              {!!p.sub && <Text style={styles.popupSub}>{p.sub}</Text>}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function HudCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.hudCell}>
      <Text style={styles.hudLabel}>{label}</Text>
      <Text style={[styles.hudValue, { color }]}>{value}</Text>
    </View>
  );
}

function SoccerBall({ ball }: { ball: Ball }) {
  const r = ball.radius;
  const panel = ball.type === "BLACK" ? "#11131A" : "#111827";
  const base = ball.type === "BLACK" ? "#2A2D35" : "#F7FAFF";
  const seam = ball.type === "BLACK" ? "#E6F1FF" : "#D6E1F0";
  const aura = ball.type === "GOLD" ? COLORS.gold : ball.type === "BLUE" ? "#3B9CFF" : ball.type === "BLACK" ? "#FF4757" : "rgba(255,255,255,0.55)";
  return (
    <Group>
      <Circle cx={ball.x} cy={ball.y} r={r + 7} color={aura} opacity={0.32} />
      <Circle cx={ball.x + 3} cy={ball.y + 5} r={r + 1} color="rgba(0,0,0,0.36)" />
      <Circle cx={ball.x} cy={ball.y} r={r} color={base} />
      <Circle cx={ball.x} cy={ball.y} r={r * 0.36} color={panel} />
      <Circle cx={ball.x - r * 0.58} cy={ball.y - r * 0.34} r={r * 0.23} color={panel} />
      <Circle cx={ball.x + r * 0.58} cy={ball.y - r * 0.34} r={r * 0.23} color={panel} />
      <Circle cx={ball.x - r * 0.42} cy={ball.y + r * 0.5} r={r * 0.2} color={panel} />
      <Circle cx={ball.x + r * 0.42} cy={ball.y + r * 0.5} r={r * 0.2} color={panel} />
      <Rect x={ball.x - r * 0.68} y={ball.y - 1.2} width={r * 1.36} height={2.4} color={seam} opacity={0.75} />
      <Rect x={ball.x - 1.2} y={ball.y - r * 0.68} width={2.4} height={r * 1.36} color={seam} opacity={0.75} />
      <Circle cx={ball.x - r * 0.28} cy={ball.y - r * 0.28} r={r * 0.08} color={seam} opacity={0.85} />
      <Circle cx={ball.x + r * 0.28} cy={ball.y + r * 0.28} r={r * 0.08} color={seam} opacity={0.85} />
      <Circle cx={ball.x - r * 0.22} cy={ball.y - r * 0.28} r={r * 0.08} color="rgba(255,255,255,0.75)" />
    </Group>
  );
}

function FootMarker({ foot }: { foot: { x: number; y: number; speed: number } }) {
  const armed = foot.speed >= 320;
  const color = foot.speed >= 900 ? COLORS.gold : armed ? COLORS.cyan : "rgba(31,224,216,0.4)";
  return (
    <Group>
      <Circle cx={foot.x} cy={foot.y} r={60} color={color} opacity={0.15} />
      <Circle cx={foot.x} cy={foot.y} r={9} color={color} />
    </Group>
  );
}

function GoalOverlay({ geom, targetZone }: { geom: any; targetZone: number }) {
  const cells = [];
  const zw = geom.gw / geom.cols;
  const zh = geom.gh / geom.rows;
  for (let c = 0; c < geom.cols; c++) {
    const isTarget = c === targetZone;
    cells.push(
      <Rect
        key={c}
        x={geom.gx + c * zw + 4}
        y={geom.gy + 8}
        width={zw - 8}
        height={geom.gh - 14}
        color={isTarget ? "rgba(255,71,87,0.42)" : "rgba(245,248,255,0.04)"}
      />
    );
  }

  const netLines = [];
  for (let i = 1; i < 6; i++) {
    const x = geom.gx + (geom.gw / 6) * i;
    netLines.push(<Rect key={`v-${i}`} x={x} y={geom.gy + 8} width={1.5} height={geom.gh - 10} color="rgba(245,248,255,0.34)" />);
  }
  for (let i = 1; i < 4; i++) {
    const y = geom.gy + (geom.gh / 4) * i;
    netLines.push(<Rect key={`h-${i}`} x={geom.gx + 5} y={y} width={geom.gw - 10} height={1.5} color="rgba(245,248,255,0.34)" />);
  }
  for (let i = 1; i < geom.cols; i++) {
    const x = geom.gx + zw * i;
    netLines.push(<Rect key={`zone-${i}`} x={x - 2} y={geom.gy + 8} width={4} height={geom.gh - 10} color="rgba(255,197,61,0.65)" />);
  }

  return (
    <Group>
      <Rect x={geom.gx - 13} y={geom.gy - 13} width={geom.gw + 26} height={geom.gh + 27} color="rgba(0,0,0,0.38)" />
      <Rect x={geom.gx} y={geom.gy} width={geom.gw} height={geom.gh} color="rgba(7,16,28,0.48)" />
      {netLines}
      {cells}
      <Rect x={geom.gx - 10} y={geom.gy - 11} width={geom.gw + 20} height={10} color="#F7FAFF" />
      <Rect x={geom.gx - 10} y={geom.gy - 11} width={10} height={geom.gh + 22} color="#F7FAFF" />
      <Rect x={geom.gx + geom.gw} y={geom.gy - 11} width={10} height={geom.gh + 22} color="#F7FAFF" />
      <Rect x={geom.gx - 10} y={geom.gy + geom.gh + 8} width={geom.gw + 20} height={5} color="rgba(247,250,255,0.72)" />
      <Rect x={geom.gx - 13} y={geom.gy - 14} width={geom.gw + 26} height={3} color={COLORS.cyan} opacity={0.9} />
      <Circle cx={geom.gx - 5} cy={geom.gy - 6} r={8} color="#F7FAFF" />
      <Circle cx={geom.gx + geom.gw + 5} cy={geom.gy - 6} r={8} color="#F7FAFF" />
    </Group>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", padding: 24 },
  msg: { color: COLORS.white, textAlign: "center" },
  overlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,9,15,0.58)",
    gap: 16,
    padding: 24,
  } as any,
  overlayTitle: { color: COLORS.white, fontSize: 16, fontWeight: "700", textAlign: "center" },
  startBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 40 },
  startBtnText: { color: COLORS.navy, fontWeight: "700", fontSize: 16 },
  hud: { position: "absolute", top: 50, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  hudCell: {
    backgroundColor: "rgba(7,9,15,0.8)",
    borderWidth: 1,
    borderColor: "rgba(31,224,216,0.3)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 88,
    alignItems: "center",
  },
  hudLabel: { color: COLORS.mute, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  hudValue: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  kickGuide: { position: "absolute", left: 0, right: 0, bottom: 28, alignItems: "center" },
  kickGuideText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: "rgba(7,9,15,0.65)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: "hidden",
  },
  popup: { position: "absolute", alignItems: "center", minWidth: 72 },
  popupText: { fontSize: 18, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4 },
  popupSub: { color: COLORS.white, fontSize: 10, fontWeight: "700", marginTop: 2, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4 },
});
