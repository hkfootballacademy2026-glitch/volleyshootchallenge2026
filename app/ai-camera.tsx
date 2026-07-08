import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";

export default function AiCameraCheckScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  return (
    <View style={styles.page}>
      {hasPermission && device ? <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} pixelFormat="yuv" /> : null}
      <View style={styles.panel}>
        <Text style={styles.title}>1. カメラ確認</Text>
        <Text style={styles.row}>Permission: {hasPermission ? "OK" : "未許可"}</Text>
        <Text style={styles.row}>Device: {device ? "OK" : "未検出"}</Text>
        <Text style={styles.note}>この画面が落ちなければ、VisionCamera単体は概ねOKです。</Text>
        <Pressable style={styles.primary} onPress={() => router.push({ pathname: "/ai-model", params: { mode, difficulty } })}>
          <Text style={styles.primaryText}>次へ: AIモデル確認</Text>
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
  panel: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: "rgba(7,9,15,0.84)", borderWidth: 1, borderColor: COLORS.line, gap: 8 },
  title: { color: COLORS.white, fontSize: 20, fontWeight: "900" },
  row: { color: COLORS.cyan, fontSize: 14, fontWeight: "800" },
  note: { color: COLORS.mute, fontSize: 12, lineHeight: 18 },
  primary: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  primaryText: { color: COLORS.navy, fontWeight: "900" },
  ghost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  ghostText: { color: COLORS.white, fontWeight: "800" },
});
