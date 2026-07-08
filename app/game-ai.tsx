import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera, useCameraFormat } from "react-native-vision-camera";
import { Canvas, Circle, Group, Rect } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";
import { Ball, GameSessionState } from "../src/game/types";
import { useGameEngine } from "../src/hooks/useGameEngine";
import { usePoseDetection } from "../src/hooks/usePoseDetection";
import { saveVideoReplay, VideoReplay } from "../src/replay/videoReplayStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function AiGameScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";
  const pose = usePoseDetection(SCREEN_W, SCREEN_H, false);
  const format = useCameraFormat(pose.device, [
    { videoResolution: { width: 720, height: 1280 } },
    { fps: 30 },
  ]);
  const [started, setStarted] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const recordingActiveRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const recordingPromiseRef = useRef<Promise<VideoReplay | null> | null>(null);
  const resolveRecordingRef = useRef<((replay: VideoReplay | null) => void) | null>(null);

  const finishReplayRecording = useCallback(async () => {
    if (!recordingActiveRef.current || !cameraRef.current) return null;
    recordingActiveRef.current = false;
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
    feet: pose.feet,
    onGameEnd: handleGameEnd,
  });

  const begin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    startReplayRecording();
    engine.start();
    setStarted(true);
  }, [engine, startReplayRecording]);

  if (!pose.hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>カメラの許可が必要です</Text>
      </View>
    );
  }
  if (!pose.device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>カメラが見つかりません</Text>
      </View>
    );
  }

  const aiReady = pose.modelLoaded && !pose.initError && !pose.modelError;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={pose.device}
        format={format}
        isActive={true}
        pixelFormat="yuv"
        frameProcessor={started ? pose.frameProcessor : undefined}
        video={true}
        audio={false}
        fps={30}
      />
      <Canvas style={StyleSheet.absoluteFill}>
        {gameMode === "TARGET" && started && <GoalOverlay geom={engine.geom} targetZone={engine.targetZone} />}
        {engine.balls.map((b) => <SoccerBall key={b.id} ball={b} />)}
        {pose.feet.left && <FootMarker foot={pose.feet.left} />}
        {pose.feet.right && <FootMarker foot={pose.feet.right} />}
      </Canvas>
      {!started ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>AI足検知（試験）</Text>
          <Text style={styles.overlaySub}>
            {aiReady ? "足をカメラに入れてスタートしてください" : "AIモデルを準備しています"}
          </Text>
          {!!pose.initError && <Text style={styles.errorText}>{pose.initError}</Text>}
          {!!pose.modelError && <Text style={styles.errorText}>{String(pose.modelError)}</Text>}
          <Pressable style={[styles.startBtn, !aiReady && styles.startBtnDisabled]} disabled={!aiReady} onPress={begin}>
            <Text style={styles.startBtnText}>スタート</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => router.replace({ pathname: "/game", params: { mode: gameMode, difficulty: diff } })}>
            <Text style={styles.ghostBtnText}>通常操作でプレイ</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.hud}>
          <HudCell label="SCORE" value={String(engine.session.score)} color={COLORS.gold} />
          <HudCell label="TIME" value={String(engine.timeRemaining)} color={engine.timeRemaining <= 10 ? COLORS.red : COLORS.white} />
          <HudCell label="HIT" value={String(engine.session.hits)} color={COLORS.white} />
        </View>
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
  const aura = ball.type === "GOLD" ? COLORS.gold : ball.type === "BLUE" ? "#3B9CFF" : ball.type === "BLACK" ? "#FF4757" : "rgba(255,255,255,0.55)";
  return (
    <Group>
      <Circle cx={ball.x} cy={ball.y} r={ball.radius + 7} color={aura} opacity={0.32} />
      <Circle cx={ball.x} cy={ball.y} r={ball.radius} color="#F7FAFF" />
      <Circle cx={ball.x} cy={ball.y} r={ball.radius * 0.34} color="#111827" />
      <Circle cx={ball.x - ball.radius * 0.52} cy={ball.y - ball.radius * 0.28} r={ball.radius * 0.2} color="#111827" />
      <Circle cx={ball.x + ball.radius * 0.52} cy={ball.y - ball.radius * 0.28} r={ball.radius * 0.2} color="#111827" />
      <Circle cx={ball.x - ball.radius * 0.38} cy={ball.y + ball.radius * 0.48} r={ball.radius * 0.18} color="#111827" />
      <Circle cx={ball.x + ball.radius * 0.38} cy={ball.y + ball.radius * 0.48} r={ball.radius * 0.18} color="#111827" />
    </Group>
  );
}

function FootMarker({ foot }: { foot: { x: number; y: number; speed: number } }) {
  const color = foot.speed >= 900 ? COLORS.gold : foot.speed >= 320 ? COLORS.cyan : "rgba(31,224,216,0.4)";
  return (
    <Group>
      <Circle cx={foot.x} cy={foot.y} r={60} color={color} opacity={0.15} />
      <Circle cx={foot.x} cy={foot.y} r={9} color={color} />
    </Group>
  );
}

function GoalOverlay({ geom, targetZone }: { geom: any; targetZone: number }) {
  const zw = geom.gw / geom.cols;
  const cells = [];
  for (let c = 0; c < geom.cols; c++) {
    cells.push(
      <Rect
        key={c}
        x={geom.gx + c * zw + 4}
        y={geom.gy + 8}
        width={zw - 8}
        height={geom.gh - 14}
        color={c === targetZone ? "rgba(255,71,87,0.42)" : "rgba(245,248,255,0.04)"}
      />
    );
  }
  return (
    <Group>
      <Rect x={geom.gx} y={geom.gy} width={geom.gw} height={geom.gh} color="rgba(7,16,28,0.48)" />
      {cells}
      <Rect x={geom.gx - 10} y={geom.gy - 11} width={geom.gw + 20} height={10} color="#F7FAFF" />
      <Rect x={geom.gx - 10} y={geom.gy - 11} width={10} height={geom.gh + 22} color="#F7FAFF" />
      <Rect x={geom.gx + geom.gw} y={geom.gy - 11} width={10} height={geom.gh + 22} color="#F7FAFF" />
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
    backgroundColor: "rgba(7,9,15,0.62)",
    gap: 14,
    padding: 24,
  } as any,
  overlayTitle: { color: COLORS.white, fontSize: 22, fontWeight: "900", textAlign: "center" },
  overlaySub: { color: COLORS.mute, fontSize: 13, fontWeight: "700", textAlign: "center" },
  errorText: { color: COLORS.red, fontSize: 12, textAlign: "center" },
  startBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 40 },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { color: COLORS.navy, fontWeight: "700", fontSize: 16 },
  ghostBtn: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  ghostBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
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
});
