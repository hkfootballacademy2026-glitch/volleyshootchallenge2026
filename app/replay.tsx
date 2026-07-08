import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import { COLORS } from "../src/theme";
import { getVideoReplay } from "../src/replay/videoReplayStore";

export default function ReplayScreen() {
  const router = useRouter();
  const replay = getVideoReplay();

  if (!replay) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>リプレイがありません</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Video
        source={{ uri: replay.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        useNativeControls
        isLooping
      />
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>戻る</Text>
        </Pressable>
        <Text style={styles.badge}>CAMERA REPLAY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.navy },
  center: { flex: 1, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: COLORS.white, fontSize: 18, fontWeight: "800" },
  button: { backgroundColor: COLORS.cyan, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  buttonText: { color: COLORS.navy, fontSize: 15, fontWeight: "800" },
  topBar: {
    position: "absolute",
    top: 50,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    backgroundColor: "rgba(7,9,15,0.72)",
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: { color: COLORS.white, fontWeight: "800" },
  badge: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    backgroundColor: "rgba(7,9,15,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,197,61,0.35)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: "hidden",
  },
});
