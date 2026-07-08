import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTensorflowModel } from "react-native-fast-tflite";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";

export default function AiModelCheckScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const model = useTensorflowModel(require("../assets/models/movenet_singlepose_lightning_int8.tflite"));
  const isReady = model.state === "loaded";

  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.title}>2. AIモデル確認</Text>
        <Text style={[styles.status, isReady ? styles.ok : styles.wait]}>Model state: {model.state}</Text>
        {model.state === "error" && <Text style={styles.error}>{String(model.error)}</Text>}
        <Text style={styles.note}>この画面が落ちなければ、react-native-fast-tflite とモデル読み込みは概ねOKです。</Text>
        <Pressable
          style={[styles.primary, !isReady && styles.disabled]}
          disabled={!isReady}
          onPress={() => router.push({ pathname: "/ai-frame", params: { mode, difficulty } })}
        >
          <Text style={styles.primaryText}>次へ: FrameProcessor/推論確認</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={() => router.back()}>
          <Text style={styles.ghostText}>戻る</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", padding: 24 },
  panel: { width: "100%", maxWidth: 420, padding: 18, borderRadius: 12, backgroundColor: "rgba(242,245,250,0.035)", borderWidth: 1, borderColor: COLORS.line, gap: 10 },
  title: { color: COLORS.white, fontSize: 20, fontWeight: "900" },
  status: { fontSize: 15, fontWeight: "900" },
  ok: { color: "#7CFC9A" },
  wait: { color: COLORS.gold },
  error: { color: COLORS.red, fontSize: 12, lineHeight: 18 },
  note: { color: COLORS.mute, fontSize: 12, lineHeight: 18 },
  primary: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  disabled: { opacity: 0.45 },
  primaryText: { color: COLORS.navy, fontWeight: "900" },
  ghost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  ghostText: { color: COLORS.white, fontWeight: "800" },
});
