import React, { useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize, useForeground } from "react-native-google-mobile-ads";
import { bannerUnitId } from "./adMob";

export function AdBanner() {
  const unitId = bannerUnitId();
  const bannerRef = useRef<BannerAd>(null);

  useForeground(() => {
    if (Platform.OS === "ios") bannerRef.current?.load();
  });

  if (!unitId) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BannerAd
        ref={bannerRef}
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "rgba(7,9,15,0.92)",
    paddingTop: 4,
    paddingBottom: 4,
  },
});
