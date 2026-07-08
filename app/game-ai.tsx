import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode } from "../src/game/constants";

export default function AiGameScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{ mode: GameMode; difficulty: Difficulty }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const diff: Difficulty = (difficulty as Difficulty) || "NORMAL";

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>AI DIAGNOSTICS</Text>
        <Text style={styles.title}>AI足検知 診断</Text>
        <Text style={styles.subtitle}>
          落ちる原因を特定するため、AI足検知を段階ごとに確認します。上から順番に押してください。
        </Text>

        <DiagButton
          title="1. カメラだけ確認"
          detail="VisionCameraだけを起動します。ここで落ちるならカメラ周りが原因です。"
          onPress={() => router.push({ pathname: "/ai-camera", params: { mode: gameMode, difficulty: diff } })}
        />
        <DiagButton
          title="2. AIモデルだけ確認"
          detail="TFLiteモデルだけを読み込みます。ここで落ちるならfast-tflite周りが原因です。"
          onPress={() => router.push({ pathname: "/ai-model", params: { mode: gameMode, difficulty: diff } })}
        />
        <DiagButton
          title="3. FrameProcessor/推論確認"
          detail="resize plugin、worklets、TFLite推論を短時間だけ動かします。"
          onPress={() => router.push({ pathname: "/ai-frame", params: { mode: gameMode, difficulty: diff } })}
        />
        <DiagButton
          title="通常操作でプレイ"
          detail="今まで通りタップ/スワイプでプレイします。"
          onPress={() => router.replace({ pathname: "/game", params: { mode: gameMode, difficulty: diff } })}
          secondary
        />
      </ScrollView>
    </View>
  );
}

function DiagButton({ title, detail, onPress, secondary }: { title: string; detail: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable style={[styles.card, secondary && styles.cardSecondary]} onPress={onPress}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDetail}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.navy },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  eyebrow: { color: COLORS.cyan, fontSize: 12, letterSpacing: 4, fontWeight: "800", textAlign: "center" },
  title: { color: COLORS.white, fontSize: 28, fontWeight: "900", textAlign: "center" },
  subtitle: { color: COLORS.mute, fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 8 },
  card: { backgroundColor: "rgba(31,224,216,0.08)", borderWidth: 1, borderColor: COLORS.cyan, borderRadius: 12, padding: 16, gap: 6 },
  cardSecondary: { backgroundColor: "rgba(242,245,250,0.03)", borderColor: COLORS.line },
  cardTitle: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  cardDetail: { color: COLORS.mute, fontSize: 12, lineHeight: 18 },
});
