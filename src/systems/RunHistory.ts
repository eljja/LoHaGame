import type { GameStore } from "./GameStore";
import type { VictoryEnding } from "./RunSummary";
import { VICTORY_ENDINGS } from "./RunSummary";

const KEY = "loha-run-history-v1";
const LEGACY_KEY = "loha-run-legacy-v1";
const MAX_RUNS = 5;

export interface RunLegacy {
  attempts: number;
  victories: number;
  bestDay: number;
  bestGrade: string;
  islands: string[];
  endings: VictoryEnding[];
}

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

  updateRunLegacy(entry);
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

export function loadRunLegacy(): RunLegacy {
  const empty: RunLegacy = { attempts: 0, victories: 0, bestDay: 0, bestGrade: "-", islands: [], endings: [] };
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return legacyFromHistory(loadRunHistory(), empty);
    const parsed = JSON.parse(raw) as Partial<RunLegacy>;
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      attempts: finiteNonNegative(parsed.attempts),
      victories: finiteNonNegative(parsed.victories),
      bestDay: finiteNonNegative(parsed.bestDay),
      bestGrade: typeof parsed.bestGrade === "string" ? parsed.bestGrade : "-",
      islands: Array.isArray(parsed.islands) ? parsed.islands.filter((v): v is string => typeof v === "string").slice(0, 8) : [],
      endings: Array.isArray(parsed.endings)
        ? parsed.endings.filter((v): v is VictoryEnding => typeof v === "string" && v in VICTORY_ENDINGS)
        : [],
    };
  } catch {
    return empty;
  }
}

function legacyFromHistory(history: RunHistoryEntry[], fallback: RunLegacy): RunLegacy {
  if (history.length === 0) return fallback;
  const best = history.reduce((current, entry) => gradeValue(entry.grade) > gradeValue(current) ? entry.grade : current, "-");
  return {
    attempts: history.length,
    victories: history.filter((entry) => entry.result === "victory").length,
    bestDay: Math.max(...history.map((entry) => Math.floor(entry.day))),
    bestGrade: best,
    islands: [...new Set(history.map((entry) => entry.island))],
    endings: [...new Set(history.map((entry) => entry.ending).filter((ending): ending is VictoryEnding => ending !== undefined))],
  };
}

export function formatRunLegacy(): string {
  const legacy = loadRunLegacy();
  if (legacy.attempts === 0) return "첫 생존 기록을 남겨보자.";
  return `도전 ${legacy.attempts}회 · 승리 ${legacy.victories}회 · 최고 Day ${legacy.bestDay} / ${legacy.bestGrade}\n` +
    `발견한 섬 ${legacy.islands.length}/5 · 확인한 엔딩 ${legacy.endings.length}/5`;
}

function saveRunHistory(runs: RunHistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    /* ignore */
  }
}

function updateRunLegacy(entry: RunHistoryEntry): void {
  const legacy = loadRunLegacy();
  legacy.attempts += 1;
  if (entry.result === "victory") legacy.victories += 1;
  legacy.bestDay = Math.max(legacy.bestDay, Math.floor(entry.day));
  if (gradeValue(entry.grade) > gradeValue(legacy.bestGrade)) legacy.bestGrade = entry.grade;
  if (!legacy.islands.includes(entry.island)) legacy.islands.push(entry.island);
  if (entry.ending && !legacy.endings.includes(entry.ending)) legacy.endings.push(entry.ending);
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch {
    /* ignore */
  }
}

function finiteNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function gradeValue(grade: string): number {
  return ({ S: 5, A: 4, B: 3, C: 2, D: 1 } as Record<string, number>)[grade] ?? 0;
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
