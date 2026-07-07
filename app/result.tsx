import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS } from "../src/theme";
import { Difficulty, GameMode, DIFFICULTY_LABEL } from "../src/game/constants";
import { calcRank } from "../src/game/kickDetection";
import { pushScoreHistory, setHighScoreIfBetter, updateStreak } from "../src/storage/gameStorage";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode: GameMode; difficulty: Difficulty; score: string; hits: string; totalBalls: string;
    maxCombo: string; perfectCount: string; penaltyCount: string; leftHits: string; rightHits: string;
    reactionAvg: string;
  }>();

  const gameMode: GameMode = params.mode === "TARGET" ? "TARGET" : "VOLLEY";
  const difficulty: Difficulty = (params.difficulty as Difficulty) || "NORMAL";
  const score = Number(params.score) || 0;
  const hits = Number(params.hits) || 0;
  const totalBalls = Number(params.totalBalls) || 0;
  const maxCombo = Number(params.maxCombo) || 0;
  const perfectCount = Number(params.perfectCount) || 0;
  const penaltyCount = Number(params.penaltyCount) || 0;
  const leftHits = Number(params.leftHits) || 0;
  const rightHits = Number(params.rightHits) || 0;
  const reactionAvg = params.reactionAvg ? Number(params.reactionAvg) : null;

  const rate = totalBalls > 0 ? Math.round((hits / totalBalls) * 100) : 0;
  const clean = penaltyCount === 0;
  const perfectRatio = hits > 0 ? perfectCount / hits : 0;
  const rank = calcRank(rate, clean, perfectRatio);

  const [isNewRecord, setIsNewRecord] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    (async () => {
      const newRecord = await setHighScoreIfBetter(gameMode, difficulty, score);
      setIsNewRecord(newRecord);
      await pushScoreHistory(gameMode, difficulty, score);
      const s = await updateStreak();
      setStreak(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeName = gameMode === "TARGET" ? "ゴールターゲット" : "ミートシュート";
  const diffName = DIFFICULTY_LABEL[difficulty];

  const onShare = () => {
    const reactPart = reactionAvg !== null ? `・平均反応${reactionAvg.toFixed(2)}秒` : "";
    Share.share({
      message: `⚽${modeName}(${diffName})で ${score}点・ランク${rank}!最大${maxCombo}コンボ${reactPart}`,
    }).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>RESULT</Text>
      <Text style={styles.rank}>{rank}</Text>
      <Text style={styles.score}>{score}</Text>
      {isNewRecord && <Text style={styles.newRecord}>★ ニューレコード! ★</Text>}
      {streak >= 2 && <Text style={styles.streak}>🔥 {streak}日連続トレーニング中!</Text>}

      <View style={styles.statsGrid}>
        <StatBox label={gameMode === "TARGET" ? "的中数" : "成功数"} value={`${hits}/${totalBalls}`} />
        <StatBox label={gameMode === "TARGET" ? "的中率" : "成功率"} value={`${rate}%`} />
        <StatBox label="最大コンボ" value={String(maxCombo)} />
        <StatBox label="PERFECT" value={String(perfectCount)} />
        <StatBox label="黒ボール減点" value={String(penaltyCount)} color={COLORS.red} />
        <StatBox label="左足 / 右足" value={`${leftHits} / ${rightHits}`} />
        {reactionAvg !== null && <StatBox label="平均反応" value={`${reactionAvg.toFixed(2)}秒`} />}
      </View>

      <Pressable style={styles.btnPrimary} onPress={() => router.replace({ pathname: "/game", params: { mode: gameMode, difficulty } })}>
        <Text style={styles.btnPrimaryText}>もう一度プレイ</Text>
      </Pressable>
      <Pressable style={styles.btnGhost} onPress={onShare}>
        <Text style={styles.btnGhostText}>結果をシェア</Text>
      </Pressable>
      <Pressable style={styles.btnGhost} onPress={() => router.replace("/")}>
        <Text style={styles.btnGhostText}>ホームに戻る</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.navy, padding: 24, gap: 12 },
  eyebrow: { color: COLORS.cyan, fontSize: 12, letterSpacing: 4, fontWeight: "700" },
  rank: { color: COLORS.gold, fontSize: 90, fontWeight: "900" },
  score: { color: COLORS.white, fontSize: 48, fontWeight: "900" },
  newRecord: { color: COLORS.gold, fontWeight: "800", fontSize: 15 },
  streak: { color: "#7CFC9A", fontSize: 13, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 420 },
  statBox: {
    backgroundColor: "rgba(242,245,250,0.03)", borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, minWidth: 100, alignItems: "center",
  },
  statLabel: { color: COLORS.mute, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  statValue: { color: COLORS.cyan, fontSize: 20, fontWeight: "800", marginTop: 4 },
  btnPrimary: { backgroundColor: COLORS.cyan, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 40, marginTop: 8 },
  btnPrimaryText: { color: COLORS.navy, fontWeight: "700", fontSize: 16 },
  btnGhost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  btnGhostText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
