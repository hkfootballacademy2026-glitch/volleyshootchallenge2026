import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";

const JP = {
  title: "2. AIモデル確認",
  status: "TFLiteモデルは無効化済み",
  note: "TestFlightでこの段階がクラッシュしているため、react-native-fast-tfliteの読み込みを使わない方式に切り替えました。次はカメラ画像を軽く縮小し、足らしい動きだけをFrameProcessorで検出します。",
  next: "次へ: 軽量FrameProcessor確認",
  back: "戻る",
};

export default function AiModelCheckScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";

  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.title}>{JP.title}</Text>
        <Text style={styles.status}>{JP.status}</Text>
        <Text style={styles.note}>{JP.note}</Text>
        <Pressable style={styles.primary} onPress={() => router.push({ pathname: "/ai-frame", params: { mode: gameMode, difficulty: diff } })}>
          <Text style={styles.primaryText}>{JP.next}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={() => router.back()}>
          <Text style={styles.ghostText}>{JP.back}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", padding: 24 },
  panel: { width: "100%", maxWidth: 420, padding: 18, borderRadius: 12, backgroundColor: "rgba(242,245,250,0.035)", borderWidth: 1, borderColor: COLORS.line, gap: 10 },
  title: { color: COLORS.white, fontSize: 20, fontWeight: "900" },
  status: { color: "#7CFC9A", fontSize: 15, fontWeight: "900" },
  note: { color: COLORS.mute, fontSize: 12, lineHeight: 18 },
  primary: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  primaryText: { color: COLORS.navy, fontWeight: "900" },
  ghost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  ghostText: { color: COLORS.white, fontWeight: "800" },
});
