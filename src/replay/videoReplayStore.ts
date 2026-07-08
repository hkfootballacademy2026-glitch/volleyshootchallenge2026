export interface VideoReplay {
  uri: string;
  durationMs: number;
  recordedAt: string;
}

let lastReplay: VideoReplay | null = null;

export function saveVideoReplay(replay: VideoReplay | null) {
  lastReplay = replay;
}

export function getVideoReplay() {
  return lastReplay;
}

export function hasVideoReplay() {
  return lastReplay !== null;
}
