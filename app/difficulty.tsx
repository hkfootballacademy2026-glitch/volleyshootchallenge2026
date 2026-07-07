import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode, MODE_META, DIFFICULTY_LABEL } from "../src/game/constants";
import { getScoreHistory, getStreak } from "../src/storage/gameStorage";
import { ScoreHistoryEntry } from "../src/game/types";

const DIFF_DETAIL: Record<Difficulty, string> = {
  EASY: "60秒・大きいボール・ゆっくり",
  NORMAL: "60秒・標準サイズ・標準速度",
  HARD: "45秒・小さいボール・高速",
};

export default function DifficultyScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode: GameMode }>();
  const gameMode: GameMode = mode === "TARGET" ? "TARGET" : "VOLLEY";
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);
  const [streak, setStreak] = useState(0);

  const reload = useCallback(() => {
    getScoreHistory(gameMode, difficulty).then(setHistory);
    getStreak().then(setStreak);
  }, [gameMode, difficulty]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    reload();
  }, [difficulty, reload]);

  const meta = MODE_META[gameMode];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>←</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{gameMode === "TARGET" ? "GOAL TARGET" : "MEET SHOT"}</Text>
      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.subtitle}>{meta.desc}</Text>

      <View style={styles.diffGrid}>
        {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((d) => (
          <Pressable
            key={d}
            style={[styles.diffCard, difficulty === d && styles.diffCardSelected]}
            onPress={() => setDifficulty(d)}
          >
            <View>
              <Text style={styles.diffName}>{DIFFICULTY_LABEL[d]}</Text>
              <Text style={styles.diffDetail}>{DIFF_DETAIL[d]}</Text>
            </View>
            <View style={[styles.dot, difficulty === d && styles.dotSelected]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.best5Box}>
        <Text style={styles.best5Title}>SCORE HISTORY — BEST 5</Text>
        {history.length === 0 ? (
          <Text style={styles.best5Empty}>まだ記録がありません。プレーしてスコアを刻もう。</Text>
        ) : (
          history.map((h, i) => (
            <View key={i} style={styles.best5Row}>
              <Text style={[styles.best5Rank, i === 0 && { color: COLORS.gold }]}>{i + 1}</Text>
              <Text style={styles.best5Score}>{h.score}</Text>
              <Text style={styles.best5Date}>{h.date}</Text>
            </View>
          ))
        )}
      </View>

      {streak >= 1 && <Text style={styles.streak}>🔥 連続トレーニング {streak}日</Text>}

      <Pressable
        style={styles.startBtn}
        onPress={() => router.push({ pathname: "/game", params: { mode: gameMode, difficulty } })}
      >
        <Text style={styles.startBtnText}>ゲームスタート</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.navy, padding: 24, gap: 14,
  },
  backBtn: {
    position: "absolute", top: 50, left: 16, width: 38, height: 38, borderRadius: 10,
    backgroundColor: "rgba(242,245,250,0.05)", borderWidth: 1, borderColor: COLORS.line,
    alignItems: "center", justifyContent: "center",
  },
  backBtnText: { color: COLORS.white, fontSize: 18 },
  eyebrow: { color: COLORS.cyan, fontSize: 12, letterSpacing: 4, fontWeight: "700" },
  title: { color: COLORS.white, fontSize: 30, fontWeight: "900" },
  subtitle: { color: COLORS.mute, fontSize: 13, textAlign: "center", maxWidth: 320 },
  diffGrid: { width: "100%", maxWidth: 380, gap: 8 },
  diffCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(242,245,250,0.03)", borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, padding: 14,
  },
  diffCardSelected: { borderColor: COLORS.cyan, backgroundColor: "rgba(31,224,216,0.08)" },
  diffName: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  diffDetail: { color: COLORS.mute, fontSize: 11, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.line },
  dotSelected: { backgroundColor: COLORS.cyan },
  best5Box: {
    width: "100%", maxWidth: 380, backgroundColor: "rgba(242,245,250,0.025)",
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 14, gap: 5,
  },
  best5Title: { color: COLORS.mute, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 4 },
  best5Empty: { color: COLORS.mute, fontSize: 12 },
  best5Row: { flexDirection: "row", alignItems: "center", gap: 10 },
  best5Rank: { color: COLORS.mute, fontSize: 11, width: 20, textAlign: "center" },
  best5Score: { color: COLORS.white, fontWeight: "800", flex: 1, fontSize: 13 },
  best5Date: { color: COLORS.mute, fontSize: 10.5 },
  streak: { color: "#7CFC9A", fontSize: 12, fontWeight: "700" },
  startBtn: {
    backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 42,
  },
  startBtnText: { color: COLORS.navy, fontWeight: "700", fontSize: 17 },
});
