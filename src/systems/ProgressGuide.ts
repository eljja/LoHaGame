import { RECIPES } from "../data/recipes";
import { ENTITIES, type EntityType } from "../data/tiles";
import { ITEMS } from "../data/items";
import type { Recipe } from "../types";
import type { GameStore } from "./GameStore";
import type { WorldEntity } from "./WorldMap";

export interface CraftingGoal {
  recipe: Recipe;
  title: string;
  purpose: string;
  complete: boolean;
  discovered: boolean;
  canCraft: boolean;
  needs: string;
}

export interface ExplorationMarker {
  icon: string;
  label: string;
  direction: string;
  distance: number;
  status: string;
}

const CRAFTING_GOAL_ORDER: Array<{ id: string; title: string; purpose: string }> = [
  { id: "stone_pickaxe", title: "동굴 열기", purpose: "철광석과 보물 탐색" },
  { id: "bonfire", title: "물/음식 안정화", purpose: "정화수와 요리 제작" },
  { id: "tent", title: "거점 완성", purpose: "밤 회복과 안전지대" },
  { id: "fishing_rod", title: "식량 루트", purpose: "낚시 포인트 활용" },
  { id: "iron_pickaxe", title: "깊은 동굴", purpose: "다이아몬드 채굴" },
  { id: "signal_fire", title: "해양 보스 대비", purpose: "10일마다 오는 습격 약화" },
  { id: "raft", title: "조기 탈출", purpose: "섬 탈출 엔딩 준비" },
];

const PINNED_ENTITY_TYPES: EntityType[] = [
  "shipwreck",
  "camp_spot",
  "tent_placed",
  "cave_entrance",
  "river_spring",
  "fishing_spot",
  "cliff_lookout",
  "buried_treasure",
  "signal_fire_unlit",
  "signal_fire_lit",
  "raft_placed",
];

export function getCraftingGoals(store: GameStore): CraftingGoal[] {
  return CRAFTING_GOAL_ORDER
    .map((goal) => {
      const recipe = RECIPES.find((r) => r.id === goal.id);
      if (!recipe) return null;
      const can = store.crafting.canCraft(recipe);
      return {
        recipe,
        title: goal.title,
        purpose: goal.purpose,
        complete: isGoalComplete(store, recipe),
        discovered: store.flags.discoveredRecipes.includes(recipe.id),
        canCraft: can.ok,
        needs: formatNeeds(recipe, store),
      };
    })
    .filter((goal): goal is CraftingGoal => goal != null);
}

export function getNextCraftingGoal(store: GameStore): CraftingGoal | null {
  return getCraftingGoals(store).find((goal) => !goal.complete) ?? null;
}

export function formatCraftingGoalLine(goal: CraftingGoal | null): string {
  if (!goal) return "제작 목표 완료: 이제 50일 생존 또는 뗏목 탈출을 노려라.";
  const state = goal.canCraft ? "제작 가능" : goal.discovered ? goal.needs : "재료를 찾으면 해금";
  return `${goal.recipe.icon} ${goal.title}: ${goal.recipe.name} (${state})`;
}

export function getExplorationMarkers(store: GameStore): ExplorationMarker[] {
  const candidates = store.map.entities
    .filter((entity) => PINNED_ENTITY_TYPES.includes(entity.type))
    .map((entity) => toMarker(store, entity));

  const bestByLabel = new Map<string, ExplorationMarker>();
  for (const marker of candidates) {
    const prev = bestByLabel.get(marker.label);
    if (!prev || marker.distance < prev.distance) bestByLabel.set(marker.label, marker);
  }

  return [...bestByLabel.values()]
    .sort((a, b) => priority(a.label) - priority(b.label) || a.distance - b.distance);
}

export function formatNearestMarkerLine(store: GameStore): string {
  const marker = getExplorationMarkers(store).find((m) => m.distance > 1) ?? getExplorationMarkers(store)[0];
  if (!marker) return "탐험 목표: 주변을 수색해 주요 장소를 찾아라.";
  return `${marker.icon} ${marker.label}: ${marker.direction} ${marker.distance}칸`;
}

function isGoalComplete(store: GameStore, recipe: Recipe): boolean {
  const result = recipe.result.id;
  if (result === "stone_pickaxe") return store.inv.bestPickaxeTier() >= 1;
  if (result === "iron_pickaxe") return store.inv.bestPickaxeTier() >= 2;
  if (result === "bonfire") return store.flags.hasBonfire || store.map.entities.some((e) => e.type === "bonfire_placed");
  if (result === "tent") return store.flags.hasTent || store.map.entities.some((e) => e.type === "tent_placed");
  if (result === "fishing_rod") return store.inv.hasTool("rod");
  if (result === "signal_fire") return store.inv.has("signal_fire") || store.map.entities.some((e) => e.type === "signal_fire_lit" || e.type === "signal_fire_unlit");
  if (result === "raft") return store.inv.has("raft") || store.map.entities.some((e) => e.type === "raft_placed");
  return store.inv.has(result);
}

function formatNeeds(recipe: Recipe, store: GameStore): string {
  const missing = recipe.inputs
    .filter((input) => store.inv.count(input.id) < input.count)
    .map((input) => `${ITEMS[input.id].name} ${store.inv.count(input.id)}/${input.count}`);
  if (missing.length === 0) return "조건 확인";
  return missing.slice(0, 2).join(", ");
}

function toMarker(store: GameStore, entity: WorldEntity): ExplorationMarker {
  const def = ENTITIES[entity.type];
  const dx = entity.tx - store.playerTx;
  const dy = entity.ty - store.playerTy;
  const distance = Math.abs(dx) + Math.abs(dy);
  return {
    icon: def.icon,
    label: markerLabel(entity.type, def.label),
    direction: directionText(dx, dy),
    distance,
    status: distance <= 1 ? "도착" : distance <= 6 ? "가까움" : "탐험 필요",
  };
}

function markerLabel(type: EntityType, fallback: string): string {
  if (type === "tent_placed") return "거점";
  if (type === "camp_spot") return "거점 자리";
  if (type === "river_spring") return "샘";
  if (type === "fishing_spot") return "낚시터";
  if (type === "buried_treasure") return "보물 흔적";
  if (type === "signal_fire_lit" || type === "signal_fire_unlit") return "봉화대";
  return fallback;
}

function directionText(dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return "현재 위치";
  const parts: string[] = [];
  if (dy < 0) parts.push("북");
  if (dy > 0) parts.push("남");
  if (dx > 0) parts.push("동");
  if (dx < 0) parts.push("서");
  return parts.join("");
}

function priority(label: string): number {
  const order = ["난파선", "거점", "거점 자리", "동굴 입구", "샘", "낚시터", "절벽 전망대", "보물 흔적", "봉화대", "뗏목"];
  const idx = order.indexOf(label);
  return idx === -1 ? 99 : idx;
}
