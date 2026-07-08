import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera } from "react-native-vision-camera";
import { Canvas, Circle } from "@shopify/react-native-skia";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";
import { useLightweightFootDetection } from "../src/hooks/useLightweightFootDetection";

const JP = {
  title: "3. 軽量FrameProcessor確認",
  waiting: "待機",
  start: "診断開始",
  stop: "診断停止",
  play: "AI足検知でプレイ",
  back: "戻る",
  frontCamera: "前面カメラ",
  backCamera: "背面カメラ",
  switchCamera: "カメラ切替",
};

export default function AiFrameCheckScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";
  const [enabled, setEnabled] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<"front" | "back">("front");
  const detector = useLightweightFootDetection(enabled, cameraPosition);
  const { diagnostics: diag } = detector;

  return (
    <View style={styles.page}>
      {detector.hasPermission && detector.device ? (
        <Camera style={StyleSheet.absoluteFill} device={detector.device} isActive={true} pixelFormat="yuv" frameProcessor={detector.frameProcessor} />
      ) : null}
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        {detector.feet.left && <Circle cx={detector.feet.left.x} cy={detector.feet.left.y} r={12} color={COLORS.cyan} />}
        {detector.feet.right && <Circle cx={detector.feet.right.x} cy={detector.feet.right.y} r={12} color={COLORS.gold} />}
      </Canvas>
      <View style={styles.panel}>
        <Text style={styles.title}>{JP.title}</Text>
        <Text style={styles.row}>Camera: {detector.hasPermission && detector.device ? (cameraPosition === "front" ? JP.frontCamera : JP.backCamera) : JP.waiting}</Text>
        <Text style={styles.row}>Resize plugin: {diag.resizeReady ? "OK" : "NG"}</Text>
        <Text style={styles.row}>Worklets bridge: {diag.bridgeReady ? "OK" : "NG"}</Text>
        <Text style={styles.row}>FrameProcessor: {enabled ? "ON" : "OFF"}</Text>
        <Text style={styles.counter}>Frames {diag.frames} / Resize {diag.resized} / Samples {diag.samples}</Text>
        <Text style={styles.counter}>Strength L {diag.leftStrength} / R {diag.rightStrength}</Text>
        <Text style={styles.counter}>RawSpeed L {diag.leftRawSpeed} / R {diag.rightRawSpeed}</Text>
        <Text style={styles.counter}>HitSpeed L {Math.round(detector.feet.left?.speed ?? 0)} / R {Math.round(detector.feet.right?.speed ?? 0)}</Text>
        {!!detector.initError && <Text style={styles.error}>Init: {detector.initError}</Text>}
        {!!diag.lastError && <Text style={styles.error}>Frame: {diag.lastError}</Text>}
        <Pressable style={styles.cameraBtn} onPress={() => setCameraPosition((value) => (value === "front" ? "back" : "front"))}>
          <Text style={styles.cameraBtnText}>{JP.switchCamera}: {cameraPosition === "front" ? JP.frontCamera : JP.backCamera}</Text>
        </Pressable>
        <Pressable style={[styles.primary, !detector.ready && styles.disabled]} disabled={!detector.ready} onPress={() => setEnabled((v) => !v)}>
          <Text style={styles.primaryText}>{enabled ? JP.stop : JP.start}</Text>
        </Pressable>
        <Pressable style={[styles.primary, styles.play]} onPress={() => router.replace({ pathname: "/game-ai", params: { mode: gameMode, difficulty: diff, play: "1" } })}>
          <Text style={styles.primaryText}>{JP.play}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={() => router.back()}>
          <Text style={styles.ghostText}>{JP.back}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.navy, justifyContent: "flex-end" },
  panel: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: "rgba(7,9,15,0.88)", borderWidth: 1, borderColor: COLORS.line, gap: 7 },
  title: { color: COLORS.white, fontSize: 19, fontWeight: "900" },
  row: { color: COLORS.cyan, fontSize: 13, fontWeight: "800" },
  counter: { color: COLORS.gold, fontSize: 13, fontWeight: "900", marginTop: 3 },
  error: { color: COLORS.red, fontSize: 11, lineHeight: 16 },
  cameraBtn: { borderWidth: 1, borderColor: COLORS.cyan, borderRadius: 10, paddingVertical: 11, alignItems: "center", backgroundColor: "rgba(31,224,216,0.12)" },
  cameraBtnText: { color: COLORS.white, fontWeight: "900" },
  primary: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  play: { backgroundColor: COLORS.cyan },
  disabled: { opacity: 0.45 },
  primaryText: { color: COLORS.navy, fontWeight: "900" },
  ghost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  ghostText: { color: COLORS.white, fontWeight: "800" },
});
