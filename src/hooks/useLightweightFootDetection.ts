import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions } from "react-native";
import { useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { FootPoint } from "../game/types";
import { calcFootVelocity } from "../game/kickDetection";

const SAMPLE_W = 96;
const SAMPLE_H = 72;
const FOOT_MIN_STRENGTH = 520;
const AI_ACTIVE_MIN_SPEED = 260;
const FOOT_SPEED_SCALE = 3.1;
const FOOT_VISIBLE_MS = 170;
const MAX_TRACK_JUMP_PX = 340;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type CameraPosition = "front" | "back";
type RawFoot = { x: number; y: number; strength: number } | null;
type RawFrame = { left: RawFoot; right: RawFoot; frames: number; resized: number; lastError?: string };

export type DetectedFeet = { left: FootPoint | null; right: FootPoint | null };

export interface LightweightFootDiagnostics {
  frames: number;
  resized: number;
  samples: number;
  leftStrength: number;
  rightStrength: number;
  leftRawSpeed: number;
  rightRawSpeed: number;
  lastError: string;
  resizeReady: boolean;
  bridgeReady: boolean;
}

export function useLightweightFootDetection(enabled: boolean, cameraPosition: CameraPosition = "front") {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraPosition);
  const [feet, setFeet] = useState<DetectedFeet>({ left: null, right: null });
  const [diag, setDiag] = useState<Omit<LightweightFootDiagnostics, "resizeReady" | "bridgeReady">>({
    frames: 0,
    resized: 0,
    samples: 0,
    leftStrength: 0,
    rightStrength: 0,
    leftRawSpeed: 0,
    rightRawSpeed: 0,
    lastError: "",
  });
  const prevRef = useRef<{ left: { x: number; y: number; ts: number } | null; right: { x: number; y: number; ts: number } | null }>({ left: null, right: null });
  const lastActiveRef = useRef<DetectedFeet>({ left: null, right: null });
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

  useEffect(() => {
    prevRef.current = { left: null, right: null };
    lastActiveRef.current = { left: null, right: null };
    setFeet({ left: null, right: null });
  }, [cameraPosition, enabled]);

  const handleFrame = useCallback((event: RawFrame) => {
    const now = Date.now();
    const toFoot = (raw: RawFoot, side: "L" | "R"): { foot: FootPoint | null; rawSpeed: number } => {
      if (!raw || raw.strength < FOOT_MIN_STRENGTH) return { foot: null, rawSpeed: 0 };
      const normalizedX = cameraPosition === "front" ? 1 - raw.x : raw.x;
      const x = normalizedX * SCREEN_W;
      const y = Math.max(SCREEN_H * 0.46, Math.min(SCREEN_H - 52, raw.y * SCREEN_H));
      const prev = side === "L" ? prevRef.current.left : prevRef.current.right;
      const velocity = calcFootVelocity(x, y, prev, now);
      const jump = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
      if (side === "L") prevRef.current.left = { x, y, ts: now };
      else prevRef.current.right = { x, y, ts: now };

      const rawSpeed = velocity.speed * FOOT_SPEED_SCALE;
      const plausible = !prev || jump <= MAX_TRACK_JUMP_PX;
      if (!plausible || rawSpeed < AI_ACTIVE_MIN_SPEED) return { foot: null, rawSpeed };
      return {
        rawSpeed,
        foot: {
          x,
          y,
          speed: Math.min(1800, rawSpeed),
          velX: velocity.velX * FOOT_SPEED_SCALE,
          velY: velocity.velY * FOOT_SPEED_SCALE,
          side,
          hitRadiusScale: 0.72,
        },
      };
    };

    const leftResult = toFoot(event.left, "L");
    const rightResult = toFoot(event.right, "R");
    const active = { left: leftResult.foot, right: rightResult.foot };
    lastActiveRef.current = active;
    setFeet(active);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      lastActiveRef.current = { left: null, right: null };
      setFeet({ left: null, right: null });
    }, FOOT_VISIBLE_MS);

    setDiag((prev) => ({
      frames: prev.frames + event.frames,
      resized: prev.resized + event.resized,
      samples: prev.samples + 1,
      leftStrength: event.left?.strength ?? 0,
      rightStrength: event.right?.strength ?? 0,
      leftRawSpeed: Math.round(leftResult.rawSpeed),
      rightRawSpeed: Math.round(rightResult.rawSpeed),
      lastError: event.lastError ?? "",
    }));
  }, [cameraPosition]);

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
        const startY = Math.floor(SAMPLE_H * 0.48);
        for (let y = startY; y < SAMPLE_H; y += 1) {
          const yWeight = 0.75 + (y - startY) / Math.max(1, SAMPLE_H - startY);
          for (let x = 0; x < SAMPLE_W; x += 1) {
            const idx = (y * SAMPLE_W + x) * 3;
            const r = input[idx] ?? 0;
            const g = input[idx + 1] ?? 0;
            const b = input[idx + 2] ?? 0;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const brightness = (r + g + b) / 3;
            const contrast = max - min;
            const shoeDark = brightness < 92;
            const shoeColored = brightness < 138 && contrast > 54;
            if (!shoeDark && !shoeColored) continue;
            const centerBias = Math.abs(x - SAMPLE_W / 2) / (SAMPLE_W / 2);
            const weight = Math.max(1, (170 - brightness + contrast * 0.55) * yWeight * (0.85 + centerBias * 0.2));
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
        const left = leftCount > FOOT_MIN_STRENGTH ? { x: leftX / leftCount / SAMPLE_W, y: leftY / leftCount / SAMPLE_H, strength: Math.round(leftCount) } : null;
        const right = rightCount > FOOT_MIN_STRENGTH ? { x: rightX / rightCount / SAMPLE_W, y: rightY / rightCount / SAMPLE_H, strength: Math.round(rightCount) } : null;
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
