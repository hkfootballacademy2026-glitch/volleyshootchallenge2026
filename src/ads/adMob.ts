import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const IOS_AD_UNITS = {
  banner: "ca-app-pub-5840457424714744/1062764834",
  interstitial: "ca-app-pub-5840457424714744/3409187574",
  rewarded: "ca-app-pub-5840457424714744/2116506378",
};

export function bannerUnitId(): string | null {
  if (__DEV__) return TestIds.ADAPTIVE_BANNER;
  return Platform.OS === "ios" ? IOS_AD_UNITS.banner : null;
}

export function interstitialUnitId(): string | null {
  if (__DEV__) return TestIds.INTERSTITIAL;
  return Platform.OS === "ios" ? IOS_AD_UNITS.interstitial : null;
}

export function rewardedUnitId(): string | null {
  if (__DEV__) return TestIds.REWARDED;
  return Platform.OS === "ios" ? IOS_AD_UNITS.rewarded : null;
}
