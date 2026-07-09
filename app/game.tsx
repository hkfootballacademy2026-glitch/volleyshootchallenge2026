import React, { useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, GestureResponderEvent, Image, ImageSourcePropType } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from "react-native-vision-camera";
import { Canvas, Circle, Rect, Group } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";
import { useGameEngine } from "../src/hooks/useGameEngine";
import { Ball, FootPoint, GameSessionState } from "../src/game/types";
import type { DetectedFeet } from "../src/game/types";
import { appendReplayFrame, saveVideoReplay, VideoReplay } from "../src/replay/videoReplayStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MANUAL_KICK_SPEED = 1250;
const MANUAL_KICK_DURATION_MS = 180;
const BALL_IMAGES: Record<Ball["type"], ImageSourcePropType> = {
  NORMAL: require("../assets/balls/ball-normal.png"),
  GOLD: require("../assets/balls/ball-gold.png"),
  BLUE: require("../assets/balls/ball-blue.png"),
  BLACK: require("../assets/balls/ball-black.png"),
};

export default function GameScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const format = useCameraFormat(device, [
    { videoResolution: { width: 720, height: 1280 } },
    { fps: 30 },
  ]);
  const [feet, setFeet] = useState<DetectedFeet>({ left: null, right: null });
  const [started, setStarted] = useState(false);
  const kickReleaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<Camera>(null);
  const recordingActiveRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const recordingPromiseRef = useRef<Promise<VideoReplay | null> | null>(null);
  const resolveRecordingRef = useRef<((replay: VideoReplay | null) => void) | null>(null);
  const replayFrameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replaySnapshotRef = useRef<{ balls: Ball[]; session: GameSessionState; timeRemaining: number } | null>(null);

  React.useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const finishReplayRecording = useCallback(async () => {
    if (!recordingActiveRef.current || !cameraRef.current) return null;
    recordingActiveRef.current = false;
    if (replayFrameTimerRef.current) {
      clearInterval(replayFrameTimerRef.current);
      replayFrameTimerRef.current = null;
    }
    try {
      await cameraRef.current.stopRecording();
    } catch {
      resolveRecordingRef.current?.(null);
      resolveRecordingRef.current = null;
    }
    const recording = recordingPromiseRef.current;
    if (!recording) return null;
    return Promise.race<VideoReplay | null>([
      recording,
      new Promise((resolve) => setTimeout(() => resolve(null), 1800)),
    ]);
  }, []);

  const startReplayRecording = useCallback(() => {
    if (!cameraRef.current || recordingActiveRef.current) return;
    saveVideoReplay(null);
    recordingActiveRef.current = true;
    recordingStartedAtRef.current = Date.now();
    recordingPromiseRef.current = new Promise((resolve) => {
      resolveRecordingRef.current = resolve;
    });
    const captureReplayFrame = () => {
      const snapshot = replaySnapshotRef.current;
      if (!snapshot) return;
      appendReplayFrame(Date.now() - recordingStartedAtRef.current, snapshot.balls, snapshot.session, snapshot.timeRemaining);
    };
    captureReplayFrame();
    if (replayFrameTimerRef.current) clearInterval(replayFrameTimerRef.current);
    replayFrameTimerRef.current = setInterval(captureReplayFrame, 100);
    try {
      cameraRef.current.startRecording({
        fileType: "mp4",
        onRecordingFinished: (video) => {
          const replay = {
            uri: video.path.startsWith("file://") ? video.path : `file://${video.path}`,
            durationMs: Math.max(0, Date.now() - recordingStartedAtRef.current),
            recordedAt: new Date().toISOString(),
          };
          saveVideoReplay(replay);
          resolveRecordingRef.current?.(replay);
          resolveRecordingRef.current = null;
        },
        onRecordingError: () => {
          saveVideoReplay(null);
          resolveRecordingRef.current?.(null);
          resolveRecordingRef.current = null;
        },
      });
    } catch {
      recordingActiveRef.current = false;
      if (replayFrameTimerRef.current) {
        clearInterval(replayFrameTimerRef.current);
        replayFrameTimerRef.current = null;
      }
      saveVideoReplay(null);
      resolveRecordingRef.current?.(null);
      resolveRecordingRef.current = null;
    }
  }, []);

  const handleGameEnd = useCallback(
    async (session: GameSessionState) => {
      await finishReplayRecording();
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
    [router, gameMode, diff, finishReplayRecording]
  );

  const engine = useGameEngine({
    mode: gameMode,
    difficulty: diff,
    screenW: SCREEN_W,
    screenH: SCREEN_H,
    feet,
    onGameEnd: handleGameEnd,
  });

  React.useEffect(() => {
    replaySnapshotRef.current = { balls: engine.balls, session: engine.session, timeRemaining: engine.timeRemaining };
  }, [engine.balls, engine.session, engine.timeRemaining]);

  const beginCountdown = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    startReplayRecording();
    engine.start();
    setStarted(true);
  }, [engine, startReplayRecording]);

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
        <Text style={styles.msg}>Camera permission is required</Text>
      </View>
    );
  }
  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera device not found</Text>
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
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={true}
        pixelFormat="yuv"
        video={true}
        audio={false}
        fps={30}
      />

      <Canvas style={StyleSheet.absoluteFill}>
        {gameMode === "TARGET" && started && <GoalOverlay geom={engine.geom} targetZone={engine.targetZone} />}
        {feet.left && <FootMarker foot={feet.left} />}
        {feet.right && <FootMarker foot={feet.right} />}
      </Canvas>

      {engine.balls.map((b) => <BallSprite key={b.id} ball={b} />)}

      {!started ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Tap or swipe low on the screen to kick</Text>
          <Pressable style={styles.startBtn} onPress={beginCountdown}>
            <Text style={styles.startBtnText}>Start</Text>
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
            <Text style={styles.kickGuideText}>Swipe low on the screen to kick</Text>
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

function BallSprite({ ball }: { ball: Ball }) {
  const size = ball.radius * 2.35;
  const glowColor = ball.type === "GOLD" ? COLORS.gold : ball.type === "BLUE" ? "#3B9CFF" : ball.type === "BLACK" ? "#FF6B2C" : "#F5F8FF";
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ballGlow,
        {
          left: ball.x - size / 2,
          top: ball.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: glowColor,
          opacity: Math.max(0.15, Math.min(1, ball.fade ?? 1)),
        },
      ]}
    >
      <Image source={BALL_IMAGES[ball.type]} style={styles.ballImage} resizeMode="cover" />
    </View>
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
  const zw = geom.gw / geom.cols;
  const topY = geom.gy;
  const bottomY = geom.gy + geom.gh;
  const netLines = [];
  for (let i = 1; i < 8; i++) {
    const x = geom.gx + (geom.gw / 8) * i;
    netLines.push(<Rect key={`v-${i}`} x={x} y={topY + 8} width={1.3} height={geom.gh - 8} color="rgba(245,248,255,0.26)" />);
  }
  for (let i = 1; i < 5; i++) {
    const y = topY + (geom.gh / 5) * i;
    netLines.push(<Rect key={`h-${i}`} x={geom.gx + 4} y={y} width={geom.gw - 8} height={1.3} color="rgba(245,248,255,0.24)" />);
  }
  for (let i = 1; i < geom.cols; i++) {
    const x = geom.gx + zw * i;
    netLines.push(<Rect key={`lane-${i}`} x={x - 1.5} y={topY + 10} width={3} height={geom.gh - 12} color="rgba(31,224,216,0.22)" />);
  }

  const keeperCx = geom.gx + zw * (targetZone + 0.5);
  const keeperFeetY = bottomY - geom.gh * 0.09;
  const keeperBodyH = geom.gh * 0.48;
  const keeperBodyW = Math.min(64, zw * 0.33);
  const keeperHeadR = Math.min(18, geom.gh * 0.11);
  const bodyY = keeperFeetY - keeperBodyH;
  const bodyX = keeperCx - keeperBodyW / 2;
  const outline = "rgba(2,8,16,0.78)";
  const keeper = "rgba(31,224,216,0.78)";
  const glove = "rgba(255,197,61,0.86)";

  return (
    <Group>
      <Rect x={geom.gx - 18} y={topY - 14} width={geom.gw + 36} height={geom.gh + 28} color="rgba(0,0,0,0.22)" />
      <Rect x={geom.gx} y={topY} width={geom.gw} height={geom.gh} color="rgba(7,16,28,0.22)" />
      {netLines}
      <Rect x={geom.gx - 10} y={topY - 9} width={geom.gw + 20} height={9} color="rgba(247,250,255,0.78)" />
      <Rect x={geom.gx - 10} y={topY - 9} width={9} height={geom.gh + 20} color="rgba(247,250,255,0.78)" />
      <Rect x={geom.gx + geom.gw + 1} y={topY - 9} width={9} height={geom.gh + 20} color="rgba(247,250,255,0.78)" />
      <Rect x={geom.gx - 12} y={bottomY + 6} width={geom.gw + 24} height={5} color="rgba(247,250,255,0.46)" />
      <Rect x={geom.gx - 12} y={topY - 12} width={geom.gw + 24} height={3} color={COLORS.cyan} opacity={0.75} />

      <Circle cx={keeperCx} cy={bodyY - keeperHeadR * 0.85} r={keeperHeadR + 4} color={outline} />
      <Rect x={bodyX - 5} y={bodyY - 4} width={keeperBodyW + 10} height={keeperBodyH * 0.72} color={outline} />
      <Rect x={keeperCx - keeperBodyW * 0.95} y={bodyY + keeperBodyH * 0.1} width={keeperBodyW * 1.9} height={11} color={outline} />
      <Circle cx={keeperCx - keeperBodyW} cy={bodyY + keeperBodyH * 0.16} r={9} color={outline} />
      <Circle cx={keeperCx + keeperBodyW} cy={bodyY + keeperBodyH * 0.16} r={9} color={outline} />
      <Circle cx={keeperCx} cy={bodyY - keeperHeadR * 0.85} r={keeperHeadR} color={keeper} />
      <Rect x={bodyX} y={bodyY} width={keeperBodyW} height={keeperBodyH * 0.7} color={keeper} />
      <Rect x={keeperCx - keeperBodyW * 0.88} y={bodyY + keeperBodyH * 0.13} width={keeperBodyW * 1.76} height={7} color={keeper} />
      <Circle cx={keeperCx - keeperBodyW} cy={bodyY + keeperBodyH * 0.16} r={6.5} color={glove} />
      <Circle cx={keeperCx + keeperBodyW} cy={bodyY + keeperBodyH * 0.16} r={6.5} color={glove} />
      <Rect x={keeperCx - keeperBodyW * 0.38} y={bodyY + keeperBodyH * 0.68} width={keeperBodyW * 0.22} height={keeperBodyH * 0.26} color={keeper} />
      <Rect x={keeperCx + keeperBodyW * 0.16} y={bodyY + keeperBodyH * 0.68} width={keeperBodyW * 0.22} height={keeperBodyH * 0.26} color={keeper} />
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
  ballGlow: { position: "absolute", overflow: "hidden", padding: 0, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  ballImage: { width: "100%", height: "100%", borderRadius: 999 },
  popup: { position: "absolute", alignItems: "center", minWidth: 72 },
  popupText: { fontSize: 18, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4 },
  popupSub: { color: COLORS.white, fontSize: 10, fontWeight: "700", marginTop: 2, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4 },
});
