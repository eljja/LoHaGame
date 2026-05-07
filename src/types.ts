export type Phase = "day" | "night";

export type ItemId =
  | "stick"
  | "stone"
  | "vine"
  | "cloth"
  | "berry"
  | "fish_raw"
  | "fish_cooked"
  | "meat_raw"
  | "meat_cooked"
  | "water_dirty"
  | "water_clean"
  | "can_food"
  | "bandage"
  | "blanket"
  | "pistol"
  | "bullet"
  | "iron_ore"
  | "diamond"
  | "torch"
  | "wood_club"
  | "stone_axe"
  | "stone_spear"
  | "fishing_rod"
  | "stone_pickaxe"
  | "iron_pickaxe"
  | "bonfire"
  | "tent"
  | "rope"
  | "metal_scrap"
  | "herbal_drink"
  | "mushroom"
  | "large_bandage"
  | "medkit"
  | "iron_sword"
  | "meat_stew"
  | "smoked_fish"
  | "energy_tonic"
  | "trail_mix"
  | "coconut"
  | "treasure_map"
  | "seed"
  | "signal_fire"
  | "raft"
  | "glass_bottle";

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string; // emoji or short symbol
  desc: string;
  stack: number;
  /** 사용 시 스탯 변화 */
  consume?: Partial<{ hp: number; hunger: number; thirst: number; energy: number }>;
  /** 장착 무기 데미지 */
  weaponDamage?: number;
  /** 광물 채굴 가능 단계(1: 돌 곡괭이, 2: 철 곡괭이) */
  pickaxeTier?: 0 | 1 | 2;
  tool?: "axe" | "pickaxe" | "rod" | "gun";
  /** 내구도(사용 가능 횟수). 0이 되면 부서진다. stackable 아이템엔 적용 안됨. */
  maxDurability?: number;
  placeable?: "bonfire" | "tent" | "signal_fire" | "seed" | "raft";
  /** 사용 시 특수 이벤트 트리거. 씬이 onUseCallback에서 분기 처리. */
  onUse?: "treasure_map" | "bottle_trade";
  category: "material" | "food" | "tool" | "weapon" | "build" | "misc";
}

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  result: { id: ItemId; count: number };
  inputs: Array<{ id: ItemId; count: number }>;
  /** 이 건축물이 설치되어 있어야 제작 가능 (예: 모닥불 위에서 요리) */
  requires?: Array<"bonfire" | "tent">;
  desc?: string;
}

export type ZoneId =
  | "beach"
  | "shipwreck"
  | "forest"
  | "river"
  | "cave_entrance"
  | "cave_interior"
  | "cliff"
  | "camp";

export interface ZoneDef {
  id: ZoneId;
  name: string;
  short: string;
  /** 기본 배경 색상 그라디언트 (낮, 밤) */
  palette: { dayTop: number; dayBot: number; nightTop: number; nightBot: number };
  /** 이모지 기반 장식 */
  decor: string[];
  actions: ZoneActionId[];
  unlock?: (state: GameState) => boolean;
}

export type ZoneActionId =
  | "look_around"
  | "gather_wood"
  | "gather_berry"
  | "gather_vine"
  | "gather_stone"
  | "hunt"
  | "drink_water"
  | "fish"
  | "collect_shell"
  | "loot_crate"
  | "scrap_metal"
  | "enter_cave"
  | "mine"
  | "sleep"
  | "observe_sea"
  | "build_camp";

export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  hp: number;
  atk: number;
  /** 도망 가능 여부 */
  canFlee: boolean;
  loot: Array<{ id: ItemId; count: number; chance: number }>;
  flavor: string;
  kind: "sea" | "land";
}

export interface GameState {
  day: number;
  hour: number; // 0..23
  phase: Phase;
  stats: { hp: number; hunger: number; thirst: number; energy: number };
  inventory: Array<{ id: ItemId; count: number } | null>; // 슬롯 배열
  equipped: { weapon?: ItemId; pickaxe?: ItemId } ;
  flags: {
    lootedCrates: number;
    hasTent: boolean;
    hasBonfire: boolean;
    firstTimeVisited: Partial<Record<ZoneId, boolean>>;
    bossesDefeated: number[]; // days cleared
    unlockedAchievements: string[];
    discoveredRecipes: string[];
    fishCaught: number;
    nightSkyBuff?: boolean; // next sleep at tent gives bonus HP
    lastNightSkyDay?: number; // game-day key of last sky observation
    /** 바다에 띄운 유리병 (2~3일 뒤 돌아옴) */
    sentBottle?: { itemId: ItemId; sentDay: number };
    /** 동굴 울림 사건 — 이 day 동안 채굴 산출 1.5배 */
    caveEchoDay?: number;
    /** 폭풍 예고 — 이 day의 밤에 폭풍 발생 (천막 보강 안하면 파괴) */
    stormIncomingDay?: number;
    /** 천막 보강 완료 (한 폭풍에 한 번 사용) */
    shelterReinforced?: boolean;
  };
  caveDepth: 0 | 1 | 2 | 3;
  savedAt?: number;
}

export interface StatDelta {
  hp?: number;
  hunger?: number;
  thirst?: number;
  energy?: number;
}
