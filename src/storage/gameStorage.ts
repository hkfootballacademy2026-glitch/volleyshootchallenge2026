import AsyncStorage from "@react-native-async-storage/async-storage";
import { Difficulty, GameMode } from "../game/constants";
import { ScoreHistoryEntry } from "../game/types";

function scoreHistKey(mode: GameMode, d: Difficulty) {
  return `volleyshoot_scorehist_${mode}_${d}`;
}
function highScoreKey(mode: GameMode, d: Difficulty) {
  return `volleyshoot_highscore_${mode}_${d}`;
}

export async function getScoreHistory(mode: GameMode, d: Difficulty): Promise<ScoreHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(scoreHistKey(mode, d));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** スコア履歴に新しい記録を追加し、上位5件に絞って保存する */
export async function pushScoreHistory(mode: GameMode, d: Difficulty, score: number): Promise<ScoreHistoryEntry[]> {
  const arr = await getScoreHistory(mode, d);
  const t = new Date();
  const dateLabel = `${t.getMonth() + 1}/${t.getDate()}`;
  arr.push({ score, date: dateLabel });
  arr.sort((a, b) => b.score - a.score);
  arr.length = Math.min(arr.length, 5);
  try {
    await AsyncStorage.setItem(scoreHistKey(mode, d), JSON.stringify(arr));
  } catch {
    // ストレージ書き込み失敗は致命的ではないため握りつぶす
  }
  return arr;
}

export async function getHighScore(mode: GameMode, d: Difficulty): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(highScoreKey(mode, d));
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setHighScoreIfBetter(mode: GameMode, d: Difficulty, score: number): Promise<boolean> {
  const prev = await getHighScore(mode, d);
  if (score > prev) {
    try {
      await AsyncStorage.setItem(highScoreKey(mode, d), String(score));
    } catch {
      /* noop */
    }
    return true;
  }
  return false;
}

function todayStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function yesterdayStr(date: Date): string {
  const y = new Date(date);
  y.setDate(y.getDate() - 1);
  return todayStr(y);
}

/** 今日のプレーを記録し、連続日数(ストリーク)を更新して返す */
export async function updateStreak(now: Date = new Date()): Promise<number> {
  try {
    const today = todayStr(now);
    const last = await AsyncStorage.getItem("volleyshoot_last_day");
    let streak = Number(await AsyncStorage.getItem("volleyshoot_streak")) || 0;
    if (last === today) return streak; // 今日すでにプレー済み
    streak = last === yesterdayStr(now) ? streak + 1 : 1;
    await AsyncStorage.setItem("volleyshoot_streak", String(streak));
    await AsyncStorage.setItem("volleyshoot_last_day", today);
    return streak;
  } catch {
    return 0;
  }
}

export async function getStreak(now: Date = new Date()): Promise<number> {
  try {
    const last = await AsyncStorage.getItem("volleyshoot_last_day");
    const streak = Number(await AsyncStorage.getItem("volleyshoot_streak")) || 0;
    if (!last) return 0;
    const today = todayStr(now);
    return last === today || last === yesterdayStr(now) ? streak : 0;
  } catch {
    return 0;
  }
}
