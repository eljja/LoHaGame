import type { ItemDef, ItemId } from "../types";

export const ITEMS: Record<ItemId, ItemDef> = {
  stick: { id: "stick", name: "나뭇가지", icon: "🪵", desc: "모든 제작의 기초.", stack: 99, category: "material" },
  stone: { id: "stone", name: "돌", icon: "🪨", desc: "단단한 돌멩이.", stack: 99, category: "material" },
  vine: { id: "vine", name: "덩굴", icon: "🌿", desc: "묶는 데 유용하다.", stack: 99, category: "material" },
  cloth: { id: "cloth", name: "천 조각", icon: "🧵", desc: "구조물과 횃불에 쓴다.", stack: 99, category: "material" },

  berry: { id: "berry", name: "야생 열매", icon: "🫐", desc: "약간의 허기를 달래준다.", stack: 99, consume: { hunger: 12, thirst: 3 }, category: "food" },
  fish_raw: { id: "fish_raw", name: "생 물고기", icon: "🐟", desc: "날것은 배탈의 위험.", stack: 99, consume: { hunger: 15, hp: -4 }, category: "food" },
  fish_cooked: { id: "fish_cooked", name: "구운 생선", icon: "🍤", desc: "잘 익혔다.", stack: 99, consume: { hunger: 35, energy: 5 }, category: "food" },
  meat_raw: { id: "meat_raw", name: "생고기", icon: "🥩", desc: "익혀 먹어야 안전하다.", stack: 99, consume: { hunger: 20, hp: -6 }, category: "food" },
  meat_cooked: { id: "meat_cooked", name: "구운 고기", icon: "🍖", desc: "든든한 한 끼.", stack: 99, consume: { hunger: 50, energy: 10 }, category: "food" },

  water_dirty: { id: "water_dirty", name: "흙탕물", icon: "🥛", desc: "마시기엔 꺼림직하다.", stack: 20, consume: { thirst: 25, hp: -5 }, category: "food" },
  water_clean: { id: "water_clean", name: "정화수", icon: "💧", desc: "맑고 시원하다.", stack: 20, consume: { thirst: 45 }, category: "food" },

  can_food: { id: "can_food", name: "통조림", icon: "🥫", desc: "배에서 주운 비상식량.", stack: 20, consume: { hunger: 55, thirst: 5 }, category: "food" },
  bandage: { id: "bandage", name: "붕대", icon: "🩹", desc: "상처를 감싼다.", stack: 20, consume: { hp: 40 }, category: "misc" },
  blanket: { id: "blanket", name: "담요", icon: "🛏", desc: "밤 추위를 막는다.", stack: 5, category: "misc" },
  pistol: { id: "pistol", name: "낡은 권총", icon: "🔫", desc: "탄이 필요하다.", stack: 1, weaponDamage: 40, category: "weapon", tool: "gun" },
  bullet: { id: "bullet", name: "탄약", icon: "•", desc: "권총용 탄.", stack: 99, category: "misc" },

  iron_ore: { id: "iron_ore", name: "철광석", icon: "⛓", desc: "정련하면 더 강해진다.", stack: 99, category: "material" },
  diamond: { id: "diamond", name: "다이아몬드", icon: "💎", desc: "눈부시게 단단하다.", stack: 99, category: "material" },
  metal_scrap: { id: "metal_scrap", name: "금속 조각", icon: "🔩", desc: "좌초된 배의 잔해.", stack: 99, category: "material" },
  rope: { id: "rope", name: "밧줄", icon: "🪢", desc: "덩굴을 꼬아 만든 줄.", stack: 20, category: "material" },

  torch: { id: "torch", name: "횃불", icon: "🔥", desc: "어둠을 밝힌다.", stack: 10, category: "tool" },
  wood_club: { id: "wood_club", name: "나무몽둥이", icon: "🏏", desc: "원시적이지만 유용.", stack: 1, weaponDamage: 8, category: "weapon" },
  stone_axe: { id: "stone_axe", name: "돌도끼", icon: "🪓", desc: "나무를 빠르게 벤다.", stack: 1, weaponDamage: 12, tool: "axe", category: "weapon" },
  stone_spear: { id: "stone_spear", name: "돌창", icon: "🗡", desc: "찌르기 공격.", stack: 1, weaponDamage: 16, category: "weapon" },
  fishing_rod: { id: "fishing_rod", name: "나무 낚싯대", icon: "🎣", desc: "강과 바다에서 낚시.", stack: 1, tool: "rod", category: "tool" },
  stone_pickaxe: { id: "stone_pickaxe", name: "돌 곡괭이", icon: "⛏", desc: "돌과 약한 광석을 캔다.", stack: 1, tool: "pickaxe", pickaxeTier: 1, category: "tool" },
  iron_pickaxe: { id: "iron_pickaxe", name: "철 곡괭이", icon: "⚒", desc: "깊은 광맥을 캔다.", stack: 1, tool: "pickaxe", pickaxeTier: 2, category: "tool" },

  bonfire: { id: "bonfire", name: "모닥불", icon: "🏕", desc: "요리·온기·경계.", stack: 1, placeable: "bonfire", category: "build" },
  tent: { id: "tent", name: "천막", icon: "⛺", desc: "편히 잠들 수 있다.", stack: 1, placeable: "tent", category: "build" },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}
