import type { GameStore } from "./GameStore";
import type { VictoryEnding } from "./RunSummary";
import { VICTORY_ENDINGS } from "./RunSummary";

const KEY = "loha-run-history-v1";
const MAX_RUNS = 5;

export interface RunHistoryEntry {
  id: string;
  savedAt: number;
  result: "victory" | "failed";
  day: number;
  grade: string;
  island: string;
  ending?: VictoryEnding;
  deathReason?: string;
  bosses: number;
  recipes: number;
  achievements: number;
}

export function recordRun(store: GameStore, result: "victory" | "failed", opts: { ending?: VictoryEnding; day?: number } = {}): void {
  const entry: RunHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: Date.now(),
    result,
    day: opts.day ?? store.time.day,
    grade: calculateRunGrade(store, result === "failed", opts.day),
    island: `${store.map.profileDef.icon} ${store.map.profileDef.name}`,
    ending: opts.ending,
    deathReason: result === "failed" ? store.stats.deathReason ?? "체력이 모두 소진됐다." : undefined,
    bosses: store.flags.bossesDefeated.length,
    recipes: store.flags.discoveredRecipes?.length ?? 0,
    achievements: store.flags.unlockedAchievements?.length ?? 0,
  };

  const runs = [entry, ...loadRunHistory().filter((r) => r.id !== entry.id)].slice(0, MAX_RUNS);
  saveRunHistory(runs);
}

export function loadRunHistory(): RunHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRunHistoryEntry).slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

export function formatRunHistoryLine(entry: RunHistoryEntry): string {
  const result = entry.result === "victory"
    ? `승리 · ${entry.ending ? VICTORY_ENDINGS[entry.ending].short : "생존"}`
    : `실패 · ${entry.deathReason ?? "원인 미상"}`;
  return `Day ${entry.day} · ${entry.grade} · ${result} · ${entry.island}`;
}

function saveRunHistory(runs: RunHistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    /* ignore */
  }
}

function calculateRunGrade(store: GameStore, failed: boolean, day = store.time.day): string {
  const score =
    day * 2 +
    store.flags.bossesDefeated.length * 18 +
    (store.flags.unlockedAchievements?.length ?? 0) * 7 +
    (store.flags.discoveredRecipes?.length ?? 0) * 2 +
    store.caveDepth * 12 -
    (failed ? 20 : 0);

  if (score >= 190) return "S";
  if (score >= 145) return "A";
  if (score >= 105) return "B";
  if (score >= 65) return "C";
  return "D";
}

function isRunHistoryEntry(value: unknown): value is RunHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<RunHistoryEntry>;
  return typeof v.id === "string" &&
    typeof v.savedAt === "number" &&
    (v.result === "victory" || v.result === "failed") &&
    typeof v.day === "number" &&
    typeof v.grade === "string" &&
    typeof v.island === "string";
}
