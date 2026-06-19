import { ACHIEVEMENTS } from "../data/achievements";
import { RECIPES } from "../data/recipes";
import type { GameStore } from "./GameStore";

export type VictoryEnding = "rescue" | "raft" | "signal" | "cave" | "settlement";

export const VICTORY_ENDINGS: Record<VictoryEnding, { label: string; short: string }> = {
  rescue: { label: "구조선 생존 엔딩", short: "구조선" },
  raft: { label: "뗏목 탈출 엔딩", short: "뗏목" },
  signal: { label: "봉화 구조 엔딩", short: "봉화" },
  cave: { label: "섬의 비밀 엔딩", short: "동굴" },
  settlement: { label: "섬 거점 엔딩", short: "거점" },
};

export function determineVictoryEnding(store: GameStore, forced?: VictoryEnding): VictoryEnding {
  if (forced) return forced;

  const signalFires = store.map.entities.filter(
    (e) => e.type === "signal_fire_lit" || e.type === "signal_fire_unlit"
  ).length;
  const hasSignalNetwork =
    store.activeCombos.has("signal_network") ||
    signalFires >= 3 ||
    !!store.flags.signalNetworkBuilt ||
    (store.flags.signalFiresUsed ?? 0) >= 3;
  if (hasSignalNetwork) return "signal";

  if (store.caveDepth >= 3 || store.inv.count("diamond") > 0) return "cave";

  const hasPlacedTent = store.map.entities.some((e) => e.type === "tent_placed");
  const hasPlacedBonfire = store.map.entities.some((e) => e.type === "bonfire_placed");
  if (store.activeCombos.has("home_base") || (hasPlacedTent && hasPlacedBonfire) || (store.flags.hasTent && store.flags.hasBonfire)) {
    return "settlement";
  }

  return "rescue";
}

export function buildRunSummary(store: GameStore, opts: { days?: number; ending?: VictoryEnding; failed?: boolean } = {}): string[] {
  const profile = store.map.profileDef;
  const days = opts.days ?? store.time.day;
  const bosses = store.flags.bossesDefeated.length;
  const achievements = store.flags.unlockedAchievements?.length ?? 0;
  const recipes = store.flags.discoveredRecipes?.length ?? 0;
  const fish = store.flags.fishCaught ?? 0;
  const structures = describeStructures(store);
  const grade = gradeRun({ days, bosses, achievements, recipes, caveDepth: store.caveDepth, failed: !!opts.failed });

  const lines = [
    `섬 성격: ${profile.icon} ${profile.name}`,
    `생존 일수: Day ${days}   ·   생존 등급: ${grade}`,
  ];

  if (opts.ending) lines.push(`엔딩: ${VICTORY_ENDINGS[opts.ending].label}`);
  lines.push(`해양 보스: ${bosses}/5   ·   동굴: ${store.caveDepth}/3층`);
  lines.push(`레시피: ${recipes}/${RECIPES.length}   ·   도전 과제: ${achievements}/${ACHIEVEMENTS.length}`);
  lines.push(`낚시 성공: ${fish}회   ·   거점: ${structures}`);
  return lines;
}

function describeStructures(store: GameStore): string {
  const parts: string[] = [];
  if (store.map.entities.some((e) => e.type === "bonfire_placed") || store.flags.hasBonfire) parts.push("모닥불");
  if (store.map.entities.some((e) => e.type === "tent_placed") || store.flags.hasTent) parts.push("천막");
  if (
    store.map.entities.some((e) => e.type === "signal_fire_lit" || e.type === "signal_fire_unlit") ||
    (store.flags.signalFiresUsed ?? 0) > 0 ||
    store.flags.signalNetworkBuilt
  ) parts.push("봉화");
  if (store.map.entities.some((e) => e.type === "raft_placed")) parts.push("뗏목");
  return parts.length > 0 ? parts.join(" / ") : "없음";
}

function gradeRun(input: { days: number; bosses: number; achievements: number; recipes: number; caveDepth: number; failed: boolean }): string {
  const score =
    input.days * 2 +
    input.bosses * 18 +
    input.achievements * 7 +
    input.recipes * 2 +
    input.caveDepth * 12 -
    (input.failed ? 20 : 0);

  if (score >= 190) return "S";
  if (score >= 145) return "A";
  if (score >= 105) return "B";
  if (score >= 65) return "C";
  return "D";
}
