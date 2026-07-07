import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera } from "react-native-vision-camera";
import { Canvas, Circle, Rect, Group, Text as SkiaText } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode, BALL_TYPE_CONFIG } from "../src/game/constants";
import { usePoseDetection } from "../src/hooks/usePoseDetection";
import { useGameEngine } from "../src/hooks/useGameEngine";
import { GameSessionState } from "../src/game/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function GameScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";

  const [mirrored] = useState(false); // 背面カメラ運用が基本のためミラーなし
  const { hasPermission, device, modelLoaded, modelError, frameProcessor, feet } =
    usePoseDetection(SCREEN_W, SCREEN_H, mirrored);

  const handleGameEnd = useCallback(
    (session: GameSessionState) => {
      router.replace({
        pathname: "/result",
        params: {
          mode: gameMode, difficulty: diff,
          score: String(session.score), hits: String(session.hits),
          totalBalls: String(session.totalBalls), maxCombo: String(session.maxCombo),
          perfectCount: String(session.perfectCount), penaltyCount: String(session.penaltyCount),
          leftHits: String(session.leftHits), rightHits: String(session.rightHits),
          reactionAvg: session.reactionTimes.length
            ? String(session.reactionTimes.reduce((a, b) => a + b, 0) / session.reactionTimes.length / 1000)
            : "",
        },
      });
    },
    [router, gameMode, diff]
  );

  const engine = useGameEngine({
    mode: gameMode, difficulty: diff, screenW: SCREEN_W, screenH: SCREEN_H,
    feet, onGameEnd: handleGameEnd,
  });

  const [started, setStarted] = useState(false);
  const bothFeetVisible = !!feet.left && !!feet.right;

  const beginCountdown = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    engine.start();
    setStarted(true);
  }, [engine]);

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
  if (modelError) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>AIモデルの読み込みに失敗しました: {String(modelError)}</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />

      <Canvas style={StyleSheet.absoluteFill}>
        {gameMode === "TARGET" && started && (
          <GoalOverlay screenW={SCREEN_W} geom={engine.geom} targetZone={engine.targetZone} />
        )}
        {engine.balls.map((b) => (
          <Circle key={b.id} cx={b.x} cy={b.y} r={b.radius} color={BALL_TYPE_CONFIG[b.type].color} />
        ))}
        {feet.left && <FootMarker foot={feet.left} />}
        {feet.right && <FootMarker foot={feet.right} />}
        {engine.popups.map((p) => (
          <SkiaText key={p.id} x={p.x - 20} y={p.y} text={p.text} color={p.color} />
        ))}
      </Canvas>

      {!started ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>{!modelLoaded ? "AIモデルを読み込み中…" : "全身がカメラに映る位置に立ってください"}</Text>
          {modelLoaded && (
            <Pressable
              style={[styles.startBtn, !bothFeetVisible && styles.startBtnDisabled]}
              onPress={beginCountdown}
              disabled={!bothFeetVisible}
            >
              <Text style={styles.startBtnText}>{bothFeetVisible ? "スタート" : "両足を検出中…"}</Text>
            </Pressable>
          )}
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

function GoalOverlay({ screenW, geom, targetZone }: { screenW: number; geom: any; targetZone: number }) {
  const cells = [];
  const zw = geom.gw / geom.cols, zh = geom.gh / geom.rows;
  for (let r = 0; r < geom.rows; r++) {
    for (let c = 0; c < geom.cols; c++) {
      const idx = r * geom.cols + c;
      const isTarget = idx === targetZone;
      cells.push(
        <Rect
          key={idx}
          x={geom.gx + c * zw + 2}
          y={geom.gy + r * zh + 2}
          width={zw - 4}
          height={zh - 4}
          color={isTarget ? "rgba(255,71,87,0.55)" : "rgba(245,248,255,0.06)"}
        />
      );
    }
  }
  return (
    <Group>
      <Rect x={geom.gx} y={geom.gy} width={geom.gw} height={geom.gh} color="rgba(11,16,38,0.35)" />
      {cells}
    </Group>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", padding: 24 },
  msg: { color: COLORS.white, textAlign: "center" },
  overlay: {
    position: "absolute", inset: 0, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(7,9,15,0.55)", gap: 16, padding: 24,
  } as any,
  overlayTitle: { color: COLORS.white, fontSize: 16, fontWeight: "700", textAlign: "center" },
  startBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 40 },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: COLORS.navy, fontWeight: "700", fontSize: 16 },
  hud: { position: "absolute", top: 50, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  hudCell: {
    backgroundColor: "rgba(7,9,15,0.8)", borderWidth: 1, borderColor: "rgba(31,224,216,0.3)",
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, minWidth: 88, alignItems: "center",
  },
  hudLabel: { color: COLORS.mute, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  hudValue: { fontSize: 22, fontWeight: "800", marginTop: 2 },
});
