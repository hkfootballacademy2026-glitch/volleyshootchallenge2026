export const POSE_ALIVE_MS = 600;
export const POSITION_HOLD_MS = 1200;
export const NO_DETECTION_HELP_MS = 20000;

export interface PositioningState {
  stableSince: number;
  startedAt: number;
}

export interface PositioningInput {
  now: number;
  hasLeftFoot: boolean;
  hasRightFoot: boolean;
  lastDetectionAt: number;
  state: PositioningState;
}

export interface PositioningResult {
  shouldStartCountdown: boolean;
  stableSince: number;
  message: string;
  ok: boolean;
}

export function evaluatePositioning(input: PositioningInput): PositioningResult {
  const poseAlive = input.now - input.lastDetectionAt < POSE_ALIVE_MS;
  const bothFeet = input.hasLeftFoot && input.hasRightFoot;

  if (bothFeet && poseAlive) {
    const stableSince = input.state.stableSince || input.now;
    return {
      shouldStartCountdown: input.now - stableSince >= POSITION_HOLD_MS,
      stableSince,
      message: "OK! そのまま動かないで…",
      ok: true,
    };
  }

  const noDetectionTooLong = input.lastDetectionAt <= 0 && input.now - input.state.startedAt >= NO_DETECTION_HELP_MS;
  return {
    shouldStartCountdown: false,
    stableSince: 0,
    message: noDetectionTooLong
      ? "全身がカメラに映る位置に立ってください\n明るい場所で、全身が映るように離れてください"
      : poseAlive
        ? "足元までカメラに映るように下がってください"
        : "全身がカメラに映る位置に立ってください",
    ok: false,
  };
}