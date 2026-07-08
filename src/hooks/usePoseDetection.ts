import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useFrameProcessor, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { FootPoint } from "../game/types";
import { calcFootVelocity } from "../game/kickDetection";

// MoveNet Lightning output layout: [1, 1, 17, 3] = (y, x, score) for 17 keypoints.
const KP = { L_ANKLE: 15, R_ANKLE: 16 };
const CONFIDENCE_THRESHOLD = 0.4;
const MODEL_SIZE = 192;
const REQUIRED_KEYPOINT_VALUES = 17 * 3;

export interface DetectedFeet {
  left: FootPoint | null;
  right: FootPoint | null;
}

interface RawFootHistory {
  x: number;
  y: number;
  ts: number;
}

interface RawFootPoint {
  x: number;
  y: number;
}

export function usePoseDetection(screenW: number, screenH: number, mirrored: boolean) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const model = useTensorflowModel(require("../../assets/models/movenet_singlepose_lightning_int8.tflite"));
  const { resize } = useResizePlugin();

  const [feet, setFeet] = useState<DetectedFeet>({ left: null, right: null });
  const prevLeftRef = useRef<RawFootHistory | null>(null);
  const prevRightRef = useRef<RawFootHistory | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handleDetection = useCallback(
    (leftRaw: RawFootPoint | null, rightRaw: RawFootPoint | null) => {
      const now = Date.now();
      const toScreen = (p: RawFootPoint) => {
        let x = p.x * screenW;
        const y = p.y * screenH;
        if (mirrored) x = screenW - x;
        return { x, y };
      };

      let left: FootPoint | null = null;
      let right: FootPoint | null = null;

      if (leftRaw) {
        const pt = toScreen(leftRaw);
        const v = calcFootVelocity(pt.x, pt.y, prevLeftRef.current, now);
        left = { x: pt.x, y: pt.y, side: "L", ...v };
        prevLeftRef.current = { x: pt.x, y: pt.y, ts: now };
      } else {
        prevLeftRef.current = null;
      }

      if (rightRaw) {
        const pt = toScreen(rightRaw);
        const v = calcFootVelocity(pt.x, pt.y, prevRightRef.current, now);
        right = { x: pt.x, y: pt.y, side: "R", ...v };
        prevRightRef.current = { x: pt.x, y: pt.y, ts: now };
      } else {
        prevRightRef.current = null;
      }

      setFeet({ left, right });
    },
    [mirrored, screenH, screenW]
  );

  const handleDetectionOnJS = useMemo(() => Worklets.createRunOnJS(handleDetection), [handleDetection]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (model.state !== "loaded") return;
      try {
        const input = resize(frame, {
          scale: { width: MODEL_SIZE, height: MODEL_SIZE },
          pixelFormat: "rgb",
          dataType: "uint8",
        });
        const output = model.model.runSync([input]);
        const kp = output?.[0] as ArrayLike<number> | undefined;
        if (!kp || kp.length < REQUIRED_KEYPOINT_VALUES) return;

        const readPoint = (idx: number) => {
          const base = idx * 3;
          const y = Number(kp[base]);
          const x = Number(kp[base + 1]);
          const score = Number(kp[base + 2]);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(score)) return null;
          return score > CONFIDENCE_THRESHOLD ? { x, y } : null;
        };
        const left = readPoint(KP.L_ANKLE);
        const right = readPoint(KP.R_ANKLE);
        handleDetectionOnJS(left, right);
      } catch (e) {
        // Skip a bad frame; the next camera frame can recover.
      }
    },
    [handleDetectionOnJS, model, resize]
  );

  return {
    hasPermission,
    device,
    modelLoaded: model.state === "loaded",
    modelError: model.state === "error" ? model.error : null,
    frameProcessor,
    feet,
  };
}
