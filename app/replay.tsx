import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { useRouter } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import { COLORS } from "../src/theme";
import { Ball } from "../src/game/types";
import { getVideoReplay, ReplayFrame } from "../src/replay/videoReplayStore";

const BALL_IMAGES: Record<Ball["type"], ImageSourcePropType> = {
  NORMAL: require("../assets/balls/ball-normal.png"),
  GOLD: require("../assets/balls/ball-gold.png"),
  BLUE: require("../assets/balls/ball-blue.png"),
  BLACK: require("../assets/balls/ball-black.png"),
};

export default function ReplayScreen() {
  const router = useRouter();
  const replay = getVideoReplay();
  const [positionMs, setPositionMs] = useState(0);
  const frame = useMemo(() => findReplayFrame(replay?.frames ?? [], positionMs), [positionMs, replay?.frames]);

  if (!replay) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No replay available</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back</Text>
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
        onPlaybackStatusUpdate={(status: any) => {
          if (status?.isLoaded && typeof status.positionMillis === "number") setPositionMs(status.positionMillis);
        }}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {frame?.balls.map((ball) => <ReplayBallSprite key={`${frame.t}-${ball.id}`} ball={ball} />)}
        {frame && (
          <View style={styles.hud}>
            <HudCell label="SCORE" value={String(frame.score)} color={COLORS.gold} />
            <HudCell label="TIME" value={String(frame.timeRemaining)} color={frame.timeRemaining <= 10 ? COLORS.red : COLORS.white} />
            <HudCell label="HIT" value={String(frame.hits)} color={COLORS.white} />
          </View>
        )}
      </View>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.badge}>GAME REPLAY</Text>
      </View>
    </View>
  );
}

function findReplayFrame(frames: ReplayFrame[], positionMs: number) {
  if (!frames.length) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (frames[mid].t <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

function ReplayBallSprite({ ball }: { ball: ReplayFrame["balls"][number] }) {
  const size = ball.radius * 2.35;
  const glowColor = ball.type === "GOLD" ? COLORS.gold : ball.type === "BLUE" ? "#3B9CFF" : ball.type === "BLACK" ? "#FF6B2C" : "#F5F8FF";
  return (
    <View
      style={[
        styles.ballGlow,
        {
          left: ball.x - size / 2,
          top: ball.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: glowColor,
          opacity: Math.max(0.15, Math.min(1, ball.fade ?? 1)),
        },
      ]}
    >
      <Image source={BALL_IMAGES[ball.type]} style={styles.ballImage} resizeMode="cover" />
    </View>
  );
}

function HudCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.hudCell}>
      <Text style={styles.hudLabel}>{label}</Text>
      <Text style={[styles.hudValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.navy },
  center: { flex: 1, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: COLORS.white, fontSize: 18, fontWeight: "800" },
  button: { backgroundColor: COLORS.cyan, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  buttonText: { color: COLORS.navy, fontSize: 15, fontWeight: "800" },
  topBar: { position: "absolute", top: 50, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { backgroundColor: "rgba(7,9,15,0.72)", borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  backButtonText: { color: COLORS.white, fontWeight: "800" },
  badge: { color: COLORS.gold, fontSize: 11, fontWeight: "800", letterSpacing: 2, backgroundColor: "rgba(7,9,15,0.72)", borderWidth: 1, borderColor: "rgba(255,197,61,0.35)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, overflow: "hidden" },
  hud: { position: "absolute", top: 104, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  hudCell: { backgroundColor: "rgba(7,9,15,0.72)", borderWidth: 1, borderColor: "rgba(31,224,216,0.3)", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, minWidth: 88, alignItems: "center" },
  hudLabel: { color: COLORS.mute, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  hudValue: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  ballGlow: { position: "absolute", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  ballImage: { width: "100%", height: "100%", borderRadius: 999 },
});