import { useCallback, useEffect, useRef } from "react";
import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";
import { interstitialUnitId } from "./adMob";

export function useResultInterstitialAd() {
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);
  const pendingShowRef = useRef(false);

  const show = useCallback(() => {
    const ad = adRef.current;
    if (!ad) return;
    if (loadedRef.current) {
      loadedRef.current = false;
      pendingShowRef.current = false;
      ad.show();
    } else {
      pendingShowRef.current = true;
    }
  }, []);

  useEffect(() => {
    const unitId = interstitialUnitId();
    if (!unitId) return;

    const ad = InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    adRef.current = ad;

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      loadedRef.current = true;
      if (pendingShowRef.current) show();
    });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false;
      pendingShowRef.current = false;
      ad.load();
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      loadedRef.current = false;
      pendingShowRef.current = false;
    });

    ad.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      adRef.current = null;
      loadedRef.current = false;
      pendingShowRef.current = false;
    };
  }, [show]);

  return show;
}
