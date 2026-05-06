import type { ItemId, ZoneActionId } from "../types";

export interface ActionDef {
  id: ZoneActionId;
  label: string;
  icon: string;
  /** 게임 내 소모 분 */
  costMinutes: number;
  /** 스탯 비용/보상 */
  costEnergy?: number;
  reward: { id: ItemId; min: number; max: number; chance?: number }[];
  /** 동작 후 로그 메시지 */
  message: (yielded: string) => string;
  /** 도구 요구 */
  requiresTool?: "rod" | "axe" | "pickaxe";
  /** 밤에만/낮에만 가능 */
  onlyPhase?: "day" | "night";
}

export const ACTIONS: Record<ZoneActionId, ActionDef> = {
  look_around: {
    id: "look_around",
    label: "둘러보기",
    icon: "👀",
    costMinutes: 10,
    reward: [],
    message: () => "주변을 천천히 살펴본다.",
  },
  gather_wood: {
    id: "gather_wood",
    label: "나무 채집",
    icon: "🪵",
    costMinutes: 20,
    costEnergy: 4,
    reward: [
      { id: "stick", min: 2, max: 4, chance: 1 },
      { id: "vine", min: 0, max: 1, chance: 0.4 },
    ],
    message: (y) => `나뭇가지를 구했다. ${y}`,
  },
  gather_berry: {
    id: "gather_berry",
    label: "열매 따기",
    icon: "🫐",
    costMinutes: 15,
    costEnergy: 2,
    reward: [{ id: "berry", min: 1, max: 3, chance: 1 }],
    message: (y) => `열매를 땄다. ${y}`,
  },
  gather_vine: {
    id: "gather_vine",
    label: "덩굴 채집",
    icon: "🌿",
    costMinutes: 15,
    costEnergy: 3,
    reward: [
      { id: "vine", min: 1, max: 3, chance: 1 },
      { id: "cloth", min: 0, max: 1, chance: 0.3 },
    ],
    message: (y) => `덩굴을 모았다. ${y}`,
  },
  gather_stone: {
    id: "gather_stone",
    label: "돌 줍기",
    icon: "🪨",
    costMinutes: 15,
    costEnergy: 3,
    reward: [{ id: "stone", min: 1, max: 3, chance: 1 }],
    message: (y) => `돌을 주웠다. ${y}`,
  },
  hunt: {
    id: "hunt",
    label: "사냥",
    icon: "🏹",
    costMinutes: 40,
    costEnergy: 10,
    reward: [], // 실제 처리는 전투 이벤트로 대체
    message: () => "사냥감을 찾아 나선다.",
    onlyPhase: "day",
  },
  drink_water: {
    id: "drink_water",
    label: "물 담기",
    icon: "💧",
    costMinutes: 10,
    reward: [{ id: "water_dirty", min: 1, max: 2, chance: 1 }],
    message: (y) => `강물을 담았다. ${y}`,
  },
  fish: {
    id: "fish",
    label: "낚시",
    icon: "🎣",
    costMinutes: 45,
    costEnergy: 6,
    requiresTool: "rod",
    reward: [{ id: "fish_raw", min: 1, max: 2, chance: 0.8 }],
    message: (y) => (y ? `입질이 왔다! ${y}` : "오늘은 입질이 없다."),
  },
  collect_shell: {
    id: "collect_shell",
    label: "조개 줍기",
    icon: "🐚",
    costMinutes: 20,
    costEnergy: 3,
    reward: [
      { id: "fish_raw", min: 0, max: 1, chance: 0.3 },
      { id: "stone", min: 0, max: 1, chance: 0.3 },
      { id: "cloth", min: 0, max: 1, chance: 0.2 },
    ],
    message: (y) => (y ? `무언가 주웠다. ${y}` : "빈 조개껍데기뿐이다."),
  },
  loot_crate: {
    id: "loot_crate",
    label: "상자 열기",
    icon: "📦",
    costMinutes: 30,
    costEnergy: 5,
    reward: [], // 특수 처리: EventManager에서
    message: () => "부서진 상자를 뒤진다.",
  },
  scrap_metal: {
    id: "scrap_metal",
    label: "금속 회수",
    icon: "🔩",
    costMinutes: 25,
    costEnergy: 5,
    reward: [
      { id: "metal_scrap", min: 1, max: 2, chance: 1 },
      { id: "cloth", min: 0, max: 1, chance: 0.3 },
    ],
    message: (y) => `배에서 뜯어냈다. ${y}`,
  },
  enter_cave: {
    id: "enter_cave",
    label: "동굴로 들어가기",
    icon: "🕳",
    costMinutes: 15,
    reward: [],
    message: () => "동굴 속으로 내려간다.",
  },
  mine: {
    id: "mine",
    label: "채굴",
    icon: "⛏",
    costMinutes: 30,
    costEnergy: 8,
    requiresTool: "pickaxe",
    reward: [],
    message: () => "곡괭이를 휘두른다.",
  },
  sleep: {
    id: "sleep",
    label: "잠자기",
    icon: "💤",
    costMinutes: 0,
    reward: [],
    message: () => "눈을 감는다…",
  },
  observe_sea: {
    id: "observe_sea",
    label: "바다 관찰",
    icon: "🔭",
    costMinutes: 20,
    reward: [],
    message: () => "수평선을 훑어본다.",
  },
  build_camp: {
    id: "build_camp",
    label: "거점 확인",
    icon: "🏕",
    costMinutes: 5,
    reward: [],
    message: () => "거점 상태를 점검한다.",
  },
};
