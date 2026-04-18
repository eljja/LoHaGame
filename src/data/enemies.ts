import type { EnemyDef } from "../types";

/** 10일마다 등장하는 해양 보스 5종 (index 0 = 10일차, 4 = 50일차) */
export const SEA_BOSSES: EnemyDef[] = [
  {
    id: "giant_octopus",
    name: "거대 문어",
    icon: "🐙",
    hp: 80,
    atk: 8,
    canFlee: false,
    kind: "sea",
    loot: [
      { id: "meat_raw", count: 3, chance: 1 },
      { id: "cloth", count: 2, chance: 0.7 },
    ],
    flavor: "촉수 8개가 해안으로 기어 올라온다.",
  },
  {
    id: "shark_pack",
    name: "식인 상어 떼",
    icon: "🦈",
    hp: 110,
    atk: 11,
    canFlee: false,
    kind: "sea",
    loot: [
      { id: "meat_raw", count: 4, chance: 1 },
      { id: "bandage", count: 1, chance: 0.5 },
    ],
    flavor: "지느러미 셋이 파도를 가른다.",
  },
  {
    id: "deep_siren",
    name: "심해 인어",
    icon: "🧜",
    hp: 140,
    atk: 14,
    canFlee: false,
    kind: "sea",
    loot: [
      { id: "diamond", count: 1, chance: 0.4 },
      { id: "cloth", count: 3, chance: 0.9 },
    ],
    flavor: "노랫소리에 정신이 혼미해진다.",
  },
  {
    id: "kraken_juvenile",
    name: "크라켄 유생",
    icon: "🦑",
    hp: 180,
    atk: 18,
    canFlee: false,
    kind: "sea",
    loot: [
      { id: "diamond", count: 2, chance: 0.6 },
      { id: "meat_raw", count: 5, chance: 1 },
    ],
    flavor: "먹물이 하늘을 가린다.",
  },
  {
    id: "abyss_tendril",
    name: "심연의 촉수",
    icon: "🌀",
    hp: 240,
    atk: 22,
    canFlee: false,
    kind: "sea",
    loot: [
      { id: "diamond", count: 3, chance: 1 },
      { id: "bandage", count: 3, chance: 1 },
    ],
    flavor: "세계의 끝에서 무엇인가가 기어 나온다.",
  },
];

/** 밤에 랜덤 조우하는 SCP풍 오리지널 약몹 */
export const NIGHT_MOBS: EnemyDef[] = [
  {
    id: "blind_shadow",
    name: "눈먼 그림자",
    icon: "👤",
    hp: 30,
    atk: 5,
    canFlee: true,
    kind: "land",
    loot: [{ id: "cloth", count: 1, chance: 0.7 }],
    flavor: "당신이 보지 않으면 움직이지 못한다.",
  },
  {
    id: "slime_debris",
    name: "점액 잔해",
    icon: "🫠",
    hp: 40,
    atk: 4,
    canFlee: true,
    kind: "land",
    loot: [
      { id: "vine", count: 1, chance: 0.5 },
      { id: "meat_raw", count: 1, chance: 0.3 },
    ],
    flavor: "배의 잔해에서 뭔가 흘러나왔다.",
  },
  {
    id: "stone_effigy",
    name: "돌 조각상",
    icon: "🗿",
    hp: 55,
    atk: 7,
    canFlee: false,
    kind: "land",
    loot: [
      { id: "stone", count: 2, chance: 1 },
      { id: "iron_ore", count: 1, chance: 0.25 },
    ],
    flavor: "눈을 깜빡이면 가까워져 있다.",
  },
];

/** 낮 사냥용 동물 */
export const DAY_GAME: EnemyDef[] = [
  {
    id: "rabbit",
    name: "산토끼",
    icon: "🐇",
    hp: 12,
    atk: 1,
    canFlee: true,
    kind: "land",
    loot: [
      { id: "meat_raw", count: 1, chance: 1 },
      { id: "cloth", count: 1, chance: 0.4 },
    ],
    flavor: "재빠른 갈색 토끼.",
  },
];
