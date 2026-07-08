import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTensorflowModel } from "react-native-fast-tflite";
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { COLORS } from "../src/theme";

const MODEL_SIZE = 192;
const REQUIRED_VALUES = 17 * 3;

type DiagEvent = {
  frames: number;
  resized: number;
  inferred: number;
  ankles: number;
  lastError: string;
};

export default function AiFrameCheckScreen() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const model = useTensorflowModel(require("../assets/models/movenet_singlepose_lightning_int8.tflite"));
  const [enabled, setEnabled] = useState(false);
  const [diag, setDiag] = useState<DiagEvent>({ frames: 0, resized: 0, inferred: 0, ankles: 0, lastError: "" });
  const [initError, setInitError] = useState("");

  let resize: ReturnType<typeof useResizePlugin>["resize"] | null = null;
  try {
    ({ resize } = useResizePlugin());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!initError) setInitError(message);
  }

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const report = useCallback((patch: Partial<DiagEvent>) => {
    setDiag((prev) => ({
      frames: prev.frames + (patch.frames ?? 0),
      resized: prev.resized + (patch.resized ?? 0),
      inferred: prev.inferred + (patch.inferred ?? 0),
      ankles: patch.ankles ?? prev.ankles,
      lastError: patch.lastError ?? prev.lastError,
    }));
  }, []);

  const reportOnJS = useMemo(() => {
    try {
      return Worklets.createRunOnJS(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setInitError(message);
      return null;
    }
  }, [report]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (!enabled || reportOnJS == null) return;
      try {
        reportOnJS({ frames: 1 });
        if (model.state !== "loaded" || resize == null) return;
        const input = resize(frame, {
          scale: { width: MODEL_SIZE, height: MODEL_SIZE },
          pixelFormat: "rgb",
          dataType: "uint8",
        });
        reportOnJS({ frames: 1, resized: 1 });
        const output = model.model.runSync([input]);
        const kp = output?.[0] as ArrayLike<number> | undefined;
        if (!kp || kp.length < REQUIRED_VALUES) {
          reportOnJS({ frames: 1, resized: 1, inferred: 1, lastError: "keypoints missing" });
          return;
        }
        const leftScore = Number(kp[15 * 3 + 2]);
        const rightScore = Number(kp[16 * 3 + 2]);
        const ankles = (leftScore > 0.3 ? 1 : 0) + (rightScore > 0.3 ? 1 : 0);
        reportOnJS({ frames: 1, resized: 1, inferred: 1, ankles, lastError: "" });
      } catch (error) {
        reportOnJS({ frames: 1, lastError: String(error) });
      }
    },
    [enabled, model, reportOnJS, resize]
  );

  const ready = hasPermission && !!device && model.state === "loaded" && !!resize && !!reportOnJS && !initError;

  return (
    <View style={styles.page}>
      {hasPermission && device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          pixelFormat="yuv"
          frameProcessor={enabled ? frameProcessor : undefined}
        />
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.title}>3. FrameProcessor/推論確認</Text>
        <Text style={styles.row}>Camera: {hasPermission && device ? "OK" : "待機"}</Text>
        <Text style={styles.row}>Model: {model.state}</Text>
        <Text style={styles.row}>Resize plugin: {resize ? "OK" : "NG"}</Text>
        <Text style={styles.row}>Worklets bridge: {reportOnJS ? "OK" : "NG"}</Text>
        <Text style={styles.row}>FrameProcessor: {enabled ? "ON" : "OFF"}</Text>
        <Text style={styles.counter}>Frames {diag.frames} / Resize {diag.resized} / Infer {diag.inferred} / Ankles {diag.ankles}</Text>
        {!!initError && <Text style={styles.error}>Init: {initError}</Text>}
        {!!diag.lastError && <Text style={styles.error}>Frame: {diag.lastError}</Text>}
        <Pressable style={[styles.primary, !ready && styles.disabled]} disabled={!ready} onPress={() => setEnabled((v) => !v)}>
          <Text style={styles.primaryText}>{enabled ? "診断停止" : "診断開始"}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={() => router.back()}>
          <Text style={styles.ghostText}>戻る</Text>
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
  primary: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  disabled: { opacity: 0.45 },
  primaryText: { color: COLORS.navy, fontWeight: "900" },
  ghost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  ghostText: { color: COLORS.white, fontWeight: "800" },
});

