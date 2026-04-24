import type { ItemDef, ItemId } from "../types";

export const ITEMS: Record<ItemId, ItemDef> = {
  stick:  { id: "stick",  name: "나뭇가지", icon: "🪵", desc: "모든 제작의 기초.",      stack: 99, category: "material" },
  stone:  { id: "stone",  name: "돌",       icon: "🪨", desc: "단단한 돌멩이.",         stack: 99, category: "material" },
  vine:   { id: "vine",   name: "덩굴",     icon: "🌿", desc: "묶는 데 유용하다.",      stack: 99, category: "material" },
  cloth:  { id: "cloth",  name: "천 조각",  icon: "🧵", desc: "구조물과 횃불에 쓴다.", stack: 99, category: "material" },

  // ── 음식 / 음료 ──────────────────────────────────────────────────────────────
  berry: {
    id: "berry", name: "야생 열매", icon: "🫐",
    desc: "약간의 허기와 피로를 달래준다.",
    stack: 99, consume: { hunger: 12, thirst: 3, energy: 6 }, category: "food",
  },
  mushroom: {
    id: "mushroom", name: "버섯", icon: "🍄",
    desc: "숲의 버섯. 약한 회복 효과.",
    stack: 99, consume: { hunger: 8, energy: 10 }, category: "food",
  },
  coconut: {
    id: "coconut", name: "야자 열매", icon: "🥥",
    desc: "해변에서 주운 야자. 수분과 열량이 풍부.",
    stack: 20, consume: { hunger: 18, thirst: 30, energy: 10 }, category: "food",
  },
  trail_mix: {
    id: "trail_mix", name: "야생식 꾸러미", icon: "🥜",
    desc: "열매와 버섯을 말려 뭉친 간식. 가벼운 한 끼.",
    stack: 20, consume: { hunger: 30, energy: 18 }, category: "food",
  },
  fish_raw: {
    id: "fish_raw", name: "생 물고기", icon: "🐟",
    desc: "날것은 배탈의 위험. 익혀 먹자.",
    stack: 99, consume: { hunger: 15, hp: -4 }, category: "food",
  },
  fish_cooked: {
    id: "fish_cooked", name: "구운 생선", icon: "🍤",
    desc: "잘 익혔다. 허기와 피로가 풀린다.",
    stack: 99, consume: { hunger: 35, energy: 12 }, category: "food",
  },
  meat_raw: {
    id: "meat_raw", name: "생고기", icon: "🥩",
    desc: "익혀 먹어야 안전하다.",
    stack: 99, consume: { hunger: 20, hp: -6 }, category: "food",
  },
  meat_cooked: {
    id: "meat_cooked", name: "구운 고기", icon: "🍖",
    desc: "든든한 한 끼. 행동력도 크게 회복된다.",
    stack: 99, consume: { hunger: 50, energy: 25 }, category: "food",
  },
  smoked_fish: {
    id: "smoked_fish", name: "훈제 생선", icon: "🍣",
    desc: "천과 함께 연기에 말린 생선. 보존성과 효능 모두 뛰어나다.",
    stack: 30, consume: { hunger: 55, thirst: 5, energy: 30 }, category: "food",
  },
  meat_stew: {
    id: "meat_stew", name: "고기 스튜", icon: "🍲",
    desc: "물과 열매로 푹 고아낸 스튜. 최고의 한 상.",
    stack: 10, consume: { hunger: 80, thirst: 30, energy: 45, hp: 15 }, category: "food",
  },

  water_dirty: {
    id: "water_dirty", name: "흙탕물", icon: "🥛",
    desc: "마시기엔 꺼림직하다. 끓이는 걸 추천.",
    stack: 20, consume: { thirst: 25, hp: -5 }, category: "food",
  },
  water_clean: {
    id: "water_clean", name: "정화수", icon: "💧",
    desc: "맑고 시원하다. 기력도 조금 회복된다.",
    stack: 20, consume: { thirst: 45, energy: 8 }, category: "food",
  },

  can_food: {
    id: "can_food", name: "통조림", icon: "🥫",
    desc: "배에서 주운 비상식량. 칼로리가 높다.",
    stack: 20, consume: { hunger: 55, thirst: 5, energy: 18 }, category: "food",
  },

  // 허브 음료: 버섯 + 물 + 모닥불로 제작, 에너지 회복 특화
  herbal_drink: {
    id: "herbal_drink", name: "허브 음료", icon: "🍵",
    desc: "버섯으로 끓인 차. 피로 회복에 최고.",
    stack: 10, consume: { energy: 50, thirst: 20 }, category: "food",
  },
  energy_tonic: {
    id: "energy_tonic", name: "강장 영약", icon: "🧪",
    desc: "허브차를 농축한 보양제. 탈진 직전에도 즉시 회복.",
    stack: 5, consume: { energy: 95, hp: 10, thirst: 10 }, category: "food",
  },

  // ── 회복 아이템 ──────────────────────────────────────────────────────────────
  bandage: {
    id: "bandage", name: "붕대", icon: "🩹",
    desc: "상처를 감싼다. HP가 회복된다.",
    stack: 20, consume: { hp: 40 }, category: "misc",
  },
  large_bandage: {
    id: "large_bandage", name: "대형 붕대", icon: "🧻",
    desc: "넓은 상처까지 감싸는 고급 붕대. 체력이 크게 회복된다.",
    stack: 10, consume: { hp: 75 }, category: "misc",
  },
  medkit: {
    id: "medkit", name: "구급상자", icon: "🧰",
    desc: "약품과 붕대가 든 상자. 즉시 완전 회복.",
    stack: 3, consume: { hp: 100, energy: 20 }, category: "misc",
  },
  blanket: {
    id: "blanket", name: "담요", icon: "🛏",
    desc: "온몸을 감싸 잠시 쉬면 행동력이 회복된다.",
    stack: 5, consume: { energy: 30 }, category: "misc",
  },

  // ── 기타 / 무기 ──────────────────────────────────────────────────────────────
  pistol:  { id: "pistol",  name: "낡은 권총", icon: "🔫", desc: "사격마다 탄약을 소비하고 기계가 마모된다. 내구도 0이면 부서진다.", stack: 1, weaponDamage: 40, category: "weapon", tool: "gun", maxDurability: 12 },
  bullet:  { id: "bullet",  name: "탄약",      icon: "•",  desc: "권총용 탄.",    stack: 99, category: "misc" },

  iron_ore:   { id: "iron_ore",   name: "철광석",  icon: "⛓",  desc: "정련하면 더 강해진다.", stack: 99, category: "material" },
  diamond:    { id: "diamond",    name: "다이아몬드", icon: "💎", desc: "눈부시게 단단하다.",   stack: 99, category: "material" },
  metal_scrap:{ id: "metal_scrap",name: "금속 조각", icon: "🔩", desc: "좌초된 배의 잔해.",    stack: 99, category: "material" },
  rope:       { id: "rope",       name: "밧줄",     icon: "🪢",  desc: "덩굴을 꼬아 만든 줄.", stack: 20, category: "material" },

  torch:        { id: "torch",        name: "횃불",       icon: "🔥", desc: "어둠을 밝힌다.",             stack: 10, category: "tool" },
  wood_club:    { id: "wood_club",    name: "나무몽둥이", icon: "🏏", desc: "원시적이지만 유용. 몇 번 휘두르면 부서진다.", stack: 1,  weaponDamage: 8,  category: "weapon", maxDurability: 20 },
  stone_axe:    { id: "stone_axe",    name: "돌도끼",     icon: "🪓", desc: "나무를 빠르게 벤다.",         stack: 1,  weaponDamage: 12, tool: "axe", category: "weapon", maxDurability: 35 },
  stone_spear:  { id: "stone_spear",  name: "돌창",       icon: "🗡", desc: "찌르기 공격.",                stack: 1,  weaponDamage: 16, category: "weapon", maxDurability: 30 },
  iron_sword:   { id: "iron_sword",   name: "철검",       icon: "⚔", desc: "벼려낸 철로 만든 강력한 검.", stack: 1,  weaponDamage: 30, category: "weapon", maxDurability: 80 },
  fishing_rod:  { id: "fishing_rod",  name: "나무 낚싯대",icon: "🎣", desc: "강과 바다에서 낚시.",          stack: 1,  tool: "rod",     category: "tool", maxDurability: 30 },
  stone_pickaxe:{ id: "stone_pickaxe",name: "돌 곡괭이",  icon: "⛏", desc: "돌과 약한 광석을 캔다.",      stack: 1,  tool: "pickaxe", pickaxeTier: 1, category: "tool", maxDurability: 45 },
  iron_pickaxe: { id: "iron_pickaxe", name: "철 곡괭이",  icon: "⚒", desc: "깊은 광맥을 캔다.",           stack: 1,  tool: "pickaxe", pickaxeTier: 2, category: "tool", maxDurability: 100 },

  bonfire: { id: "bonfire", name: "모닥불", icon: "🏕", desc: "요리·온기·경계.", stack: 1, placeable: "bonfire", category: "build" },
  tent:    { id: "tent",    name: "천막",   icon: "⛺", desc: "편히 잠들 수 있다.", stack: 1, placeable: "tent",    category: "build" },

  treasure_map: {
    id: "treasure_map", name: "낡은 보물 지도", icon: "🗺",
    desc: "사용하면 섬 어딘가에 묻힌 보물의 위치가 밝혀진다. 곡괭이로 파내자.",
    stack: 5, category: "misc", onUse: "treasure_map",
  },

  seed: {
    id: "seed", name: "열매 씨앗", icon: "🌱",
    desc: "풀밭에 심으면 2일 뒤 열매덤불로 자라 수확할 수 있다.",
    stack: 20, category: "material", placeable: "seed",
  },
  signal_fire: {
    id: "signal_fire", name: "봉화대", icon: "🗼",
    desc: "절벽에 설치 후 횃불로 점화하면 해양 보스의 전투력을 30% 낮춘다.",
    stack: 3, category: "build", placeable: "signal_fire",
  },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}
