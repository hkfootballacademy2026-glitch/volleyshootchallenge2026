import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions } from "react-native";
import { useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { FootPoint } from "../game/types";
import { calcFootVelocity } from "../game/kickDetection";

const SAMPLE_W = 64;
const SAMPLE_H = 48;
const FOOT_MIN_PIXELS = 18;
const FOOT_SPEED_SCALE = 2.4;
const FOOT_VISIBLE_MS = 260;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type RawFoot = { x: number; y: number; strength: number } | null;
type RawFrame = { left: RawFoot; right: RawFoot; frames: number; resized: number; lastError?: string };

export type DetectedFeet = { left: FootPoint | null; right: FootPoint | null };

export interface LightweightFootDiagnostics {
  frames: number;
  resized: number;
  samples: number;
  leftStrength: number;
  rightStrength: number;
  lastError: string;
  resizeReady: boolean;
  bridgeReady: boolean;
}

export function useLightweightFootDetection(enabled: boolean) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const [feet, setFeet] = useState<DetectedFeet>({ left: null, right: null });
  const [diag, setDiag] = useState<Omit<LightweightFootDiagnostics, "resizeReady" | "bridgeReady">>({
    frames: 0,
    resized: 0,
    samples: 0,
    leftStrength: 0,
    rightStrength: 0,
    lastError: "",
  });
  const prevRef = useRef<{ left: { x: number; y: number; ts: number } | null; right: { x: number; y: number; ts: number } | null }>({ left: null, right: null });
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  let resize: ReturnType<typeof useResizePlugin>["resize"] | null = null;
  let initError = "";
  try {
    ({ resize } = useResizePlugin());
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
  }

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handleFrame = useCallback((event: RawFrame) => {
    const now = Date.now();
    const toFoot = (raw: RawFoot, side: "L" | "R"): FootPoint | null => {
      if (!raw) return null;
      const x = raw.x * SCREEN_W;
      const y = Math.max(SCREEN_H * 0.38, Math.min(SCREEN_H - 58, raw.y * SCREEN_H));
      const prev = side === "L" ? prevRef.current.left : prevRef.current.right;
      const velocity = calcFootVelocity(x, y, prev, now);
      const foot: FootPoint = {
        x,
        y,
        speed: velocity.speed * FOOT_SPEED_SCALE,
        velX: velocity.velX * FOOT_SPEED_SCALE,
        velY: velocity.velY * FOOT_SPEED_SCALE,
        side,
      };
      if (side === "L") prevRef.current.left = { x, y, ts: now };
      else prevRef.current.right = { x, y, ts: now };
      return foot;
    };

    const left = toFoot(event.left, "L");
    const right = toFoot(event.right, "R");
    setFeet({ left, right });
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setFeet({ left: null, right: null }), FOOT_VISIBLE_MS);
    setDiag((prev) => ({
      frames: prev.frames + event.frames,
      resized: prev.resized + event.resized,
      samples: prev.samples + 1,
      leftStrength: event.left?.strength ?? 0,
      rightStrength: event.right?.strength ?? 0,
      lastError: event.lastError ?? "",
    }));
  }, []);

  const handleFrameOnJS = useMemo(() => {
    try {
      return Worklets.createRunOnJS(handleFrame);
    } catch {
      return null;
    }
  }, [handleFrame]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (!enabled || resize == null || handleFrameOnJS == null) return;
      try {
        const input = resize(frame, {
          scale: { width: SAMPLE_W, height: SAMPLE_H },
          pixelFormat: "rgb",
          dataType: "uint8",
        }) as Uint8Array;

        let leftCount = 0;
        let rightCount = 0;
        let leftX = 0;
        let leftY = 0;
        let rightX = 0;
        let rightY = 0;
        const startY = Math.floor(SAMPLE_H * 0.42);
        for (let y = startY; y < SAMPLE_H; y += 1) {
          for (let x = 0; x < SAMPLE_W; x += 1) {
            const idx = (y * SAMPLE_W + x) * 3;
            const r = input[idx] ?? 0;
            const g = input[idx + 1] ?? 0;
            const b = input[idx + 2] ?? 0;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const brightness = (r + g + b) / 3;
            const contrast = max - min;
            const footLike = brightness < 108 || (brightness < 150 && contrast > 42);
            if (!footLike) continue;
            const weight = Math.max(1, 180 - brightness + contrast * 0.4);
            if (x < SAMPLE_W / 2) {
              leftCount += weight;
              leftX += x * weight;
              leftY += y * weight;
            } else {
              rightCount += weight;
              rightX += x * weight;
              rightY += y * weight;
            }
          }
        }
        const left = leftCount > FOOT_MIN_PIXELS ? { x: leftX / leftCount / SAMPLE_W, y: leftY / leftCount / SAMPLE_H, strength: Math.round(leftCount) } : null;
        const right = rightCount > FOOT_MIN_PIXELS ? { x: rightX / rightCount / SAMPLE_W, y: rightY / rightCount / SAMPLE_H, strength: Math.round(rightCount) } : null;
        handleFrameOnJS({ left, right, frames: 1, resized: 1, lastError: "" });
      } catch (error) {
        handleFrameOnJS({ left: null, right: null, frames: 1, resized: 0, lastError: String(error) });
      }
    },
    [enabled, resize, handleFrameOnJS]
  );

  const diagnostics: LightweightFootDiagnostics = {
    ...diag,
    resizeReady: !!resize,
    bridgeReady: !!handleFrameOnJS,
  };

  return {
    hasPermission,
    device,
    frameProcessor: enabled ? frameProcessor : undefined,
    feet,
    diagnostics,
    initError,
    ready: hasPermission && !!device && !!resize && !!handleFrameOnJS && !initError,
  };
}
