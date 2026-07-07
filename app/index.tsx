import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../src/theme";
import { GameMode, MODE_META } from "../src/game/constants";

const MODE_ICONS: Record<GameMode, string> = { VOLLEY: "⚡", TARGET: "🎯" };

export default function ModeSelectScreen() {
  const router = useRouter();

  const selectMode = (mode: GameMode) => {
    router.push({ pathname: "/difficulty", params: { mode } });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>AI FOOTBALL TRAINING</Text>
      <Text style={styles.title}>
        VOLLEYSHOOT{"\n"}
        <Text style={{ color: COLORS.cyan }}>CHALLENGE</Text>
      </Text>
      <Text style={styles.subtitle}>
        カメラの前に立って、画面に飛んでくるボールを実際に足で蹴ろう。AIがあなたの足の動きをリアルタイムで検出します。
      </Text>

      <View style={styles.modeGrid}>
        {(Object.keys(MODE_META) as GameMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
            onPress={() => selectMode(mode)}
          >
            <View style={styles.modeIcon}>
              <Text style={{ fontSize: 20 }}>{MODE_ICONS[mode]}</Text>
            </View>
            <Text style={styles.modeTitle}>{MODE_META[mode].title}</Text>
            <Text style={styles.modeDesc}>{MODE_META[mode].desc}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.howto}>
        <Text style={styles.howtoLine}><Text style={styles.bold}>1. </Text>スマホを床や台に立てかけて固定する</Text>
        <Text style={styles.howtoLine}><Text style={styles.bold}>2. </Text>2〜3歩下がって、足元まで全身が映るようにする</Text>
        <Text style={styles.howtoLine}><Text style={styles.bold}>3. </Text>ボールは足を振って蹴る!触れるだけでは無得点、速く振るとPERFECTで1.5倍</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.navy, padding: 24, gap: 16,
  },
  eyebrow: { color: COLORS.cyan, fontSize: 12, letterSpacing: 4, fontWeight: "700" },
  title: {
    color: COLORS.white, fontSize: 34, fontWeight: "900", textAlign: "center",
    lineHeight: 40, marginTop: 8,
  },
  subtitle: { color: COLORS.mute, fontSize: 13.5, textAlign: "center", maxWidth: 340, lineHeight: 20 },
  modeGrid: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%", maxWidth: 480 },
  modeCard: {
    flex: 1, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, padding: 18,
  },
  modeCardPressed: { borderColor: "rgba(31,224,216,0.4)", transform: [{ scale: 0.98 }] },
  modeIcon: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: "rgba(31,224,216,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  modeTitle: { color: COLORS.white, fontSize: 17, fontWeight: "700" },
  modeDesc: { color: COLORS.mute, fontSize: 11, marginTop: 6, lineHeight: 16 },
  howto: {
    backgroundColor: "rgba(242,245,250,0.03)", borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, padding: 14, maxWidth: 420, gap: 6, marginTop: 8,
  },
  howtoLine: { color: COLORS.mute, fontSize: 12.5, lineHeight: 19 },
  bold: { color: COLORS.cyan, fontWeight: "700" },
});
