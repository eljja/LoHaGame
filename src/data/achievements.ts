export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  perk?: { desc: string };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_fire",
    name: "첫 불꽃",
    icon: "🔥",
    desc: "처음으로 모닥불을 만들었다.",
    perk: { desc: "허기 감소 10% ↓" },
  },
  {
    id: "first_hunt",
    name: "첫 사냥꾼",
    icon: "🐇",
    desc: "처음으로 야생 동물을 추격했다.",
    perk: { desc: "채집 시 10% 확률로 아이템 +1" },
  },
  {
    id: "cave_floor3",
    name: "심층 탐험가",
    icon: "⛏",
    desc: "동굴 3층에 처음으로 진입했다.",
    perk: { desc: "최대 HP +10 (잠 잘 때 회복량 증가)" },
  },
  {
    id: "boss_x3",
    name: "바다의 정복자",
    icon: "⚔",
    desc: "해양 보스를 3회 격파했다.",
    perk: { desc: "전투 공격력 +5" },
  },
  {
    id: "day25",
    name: "베테랑 생존자",
    icon: "🌟",
    desc: "25일을 살아남았다.",
    perk: { desc: "행동력 감소 10% ↓" },
  },
  {
    id: "treasure_dug",
    name: "보물 사냥꾼",
    icon: "💰",
    desc: "묻힌 보물을 처음으로 발굴했다.",
    perk: { desc: "희귀 드롭 확률 소폭 상승" },
  },
  {
    id: "master_chef",
    name: "섬의 요리사",
    icon: "🍲",
    desc: "고기 스튜를 처음으로 제작했다.",
    perk: { desc: "허기 감소 15% 추가 ↓" },
  },
  {
    id: "fish5",
    name: "섬의 어부",
    icon: "🎣",
    desc: "낚시로 생선을 5마리 잡았다.",
    perk: { desc: "낚시 판정 시간 +0.5초" },
  },
  {
    id: "stargazer",
    name: "별의 관찰자",
    icon: "🌠",
    desc: "밤하늘 특수 이벤트를 처음으로 목격했다.",
    perk: { desc: "야간 행동력 감소 50% ↓" },
  },
];
