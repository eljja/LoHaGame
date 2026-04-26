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

/** 미니보스 3종 — 해양 보스 사이를 채우는 중간 난이도 적. */
export const MINI_BOSSES: Record<"thorn_vine" | "pale_miner" | "abyss_scrap", EnemyDef> = {
  thorn_vine: {
    id: "thorn_vine",
    name: "엉킨 가시덤불",
    icon: "🌵",
    hp: 90,
    atk: 9,
    canFlee: true,
    kind: "land",
    loot: [
      { id: "vine", count: 5, chance: 1 },
      { id: "stick", count: 4, chance: 1 },
      { id: "berry", count: 3, chance: 0.7 },
      { id: "rope", count: 1, chance: 0.4 },
    ],
    flavor: "숲 밑에서 가시가 스스로 꿈틀거리며 솟아올랐다.",
  },
  pale_miner: {
    id: "pale_miner",
    name: "창백한 광부",
    icon: "👷",
    hp: 140,
    atk: 14,
    canFlee: false,
    kind: "land",
    loot: [
      { id: "iron_ore", count: 5, chance: 1 },
      { id: "diamond", count: 1, chance: 0.5 },
      { id: "stone_pickaxe", count: 1, chance: 0.3 },
      { id: "large_bandage", count: 1, chance: 0.4 },
    ],
    flavor: "창백한 얼굴의 광부가 곡괭이를 들고 다가온다. 눈이 없다.",
  },
  abyss_scrap: {
    id: "abyss_scrap",
    name: "심해의 잔해",
    icon: "🕳",
    hp: 120,
    atk: 12,
    canFlee: true,
    kind: "land",
    loot: [
      { id: "metal_scrap", count: 5, chance: 1 },
      { id: "cloth", count: 3, chance: 0.8 },
      { id: "bullet", count: 8, chance: 0.6 },
      { id: "treasure_map", count: 1, chance: 0.3 },
    ],
    flavor: "해변에 쏟아진 고철 더미가 저절로 모여 형체를 이룬다.",
  },
};

/** 낮 사냥용 동물 — id 순서로 entity type과 매핑 */
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
  {
    id: "wolf",
    name: "야생 늑대",
    icon: "🐺",
    hp: 40,
    atk: 14,
    canFlee: true,
    kind: "land",
    loot: [
      { id: "meat_raw", count: 3, chance: 1 },
      { id: "cloth", count: 2, chance: 0.7 },
      { id: "rope", count: 1, chance: 0.3 },
    ],
    flavor: "이빨을 드러낸 굶주린 늑대가 달려든다.",
  },
  {
    id: "boar",
    name: "성난 멧돼지",
    icon: "🐗",
    hp: 55,
    atk: 11,
    canFlee: false,
    kind: "land",
    loot: [
      { id: "meat_raw", count: 4, chance: 1 },
      { id: "meat_raw", count: 2, chance: 0.5 },
      { id: "stick", count: 2, chance: 0.6 },
      { id: "bandage", count: 1, chance: 0.25 },
    ],
    flavor: "엄니가 번들거리는 멧돼지가 땅을 박차며 돌진한다.",
  },
];
