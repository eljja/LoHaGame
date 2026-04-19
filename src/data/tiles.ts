/**
 * 타일형 오픈월드 정의.
 * - 64x64 셀, 셀당 32픽셀 → 2048x2048 월드
 * - 섬 중앙부: 풀/숲, 바깥 링: 해변, 더 바깥: 바다(이동 불가)
 * - 엔티티(자원/POI)는 타일 위에 배치되고, 플레이어가 인접 타일에서 클릭하면 상호작용
 */

export const WORLD_TILES = 64;
export const TILE_PX = 32;
export const WORLD_PX = WORLD_TILES * TILE_PX; // 2048

export type TerrainType =
  | "deep_water"
  | "shallow_water"
  | "sand"
  | "grass"
  | "forest"
  | "rock"
  | "river"
  | "cliff_rock";

export interface TerrainDef {
  name: string;
  color: number;
  walkable: boolean;
  /** 타일 표면에 자주 찍히는 장식 이모지 (빈도 0~1) */
  accent?: { icon: string; freq: number };
  /** 서브톤 (무작위 패턴) */
  mottle?: number;
}

export const TERRAIN: Record<TerrainType, TerrainDef> = {
  deep_water: { name: "깊은 바다", color: 0x0a1e44, walkable: false, mottle: 0x0e2a5c },
  shallow_water: { name: "얕은 바다", color: 0x1f4b7c, walkable: false, mottle: 0x2a5a92 },
  sand: { name: "해변", color: 0xd6c084, walkable: true, mottle: 0xc9b27a },
  grass: { name: "풀밭", color: 0x3a6b3a, walkable: true, mottle: 0x2e5a2e },
  forest: { name: "숲", color: 0x254a28, walkable: true, mottle: 0x1b3a1d, accent: { icon: "🌲", freq: 0.35 } },
  rock: { name: "돌산", color: 0x5a6070, walkable: true, mottle: 0x474c5c },
  river: { name: "강", color: 0x3a7cb5, walkable: false, mottle: 0x2e6aa1 },
  cliff_rock: { name: "절벽", color: 0x7a7088, walkable: true, mottle: 0x635a72 },
};

export type EntityType =
  | "tree"
  | "berry_bush"
  | "stone_outcrop"
  | "vine"
  | "shell"
  | "driftwood"
  | "mushroom"
  | "rabbit"
  | "flower"
  | "cave_entrance"
  | "shipwreck"
  | "cliff_lookout"
  | "river_spring"
  | "camp_spot"
  | "fishing_spot";

export interface EntityTypeDef {
  icon: string;
  label: string;
  /** 생성 가능한 지형 */
  terrain: TerrainType[];
  /** 월드 전체 동시 최대치 */
  cap: number;
  /** 매일 밤→낮 전환 시 부족분 리스폰 여부 */
  respawn: boolean;
  /** 플레이어가 들어갈 수 있는지 (대체로 자원 타일은 밟을 수 없게) */
  blocksMovement: boolean;
  /** 상호작용 반경 (0 = 같은 타일만, 1 = 4방향 인접) */
  reach: 0 | 1;
}

export const ENTITIES: Record<EntityType, EntityTypeDef> = {
  tree:         { icon: "🌳", label: "나무",       terrain: ["forest", "grass"],  cap: 120, respawn: true,  blocksMovement: true,  reach: 1 },
  berry_bush:   { icon: "🫐", label: "열매덤불",   terrain: ["grass", "forest"],  cap: 80,  respawn: true,  blocksMovement: false, reach: 0 },
  stone_outcrop:{ icon: "🪨", label: "돌무더기",   terrain: ["rock", "sand"],     cap: 60,  respawn: true,  blocksMovement: true,  reach: 1 },
  vine:         { icon: "🌿", label: "덩굴",       terrain: ["forest"],           cap: 60,  respawn: true,  blocksMovement: false, reach: 0 },
  shell:        { icon: "🐚", label: "조개",       terrain: ["sand"],             cap: 60,  respawn: true,  blocksMovement: false, reach: 0 },
  driftwood:    { icon: "🪵", label: "유목",       terrain: ["sand"],             cap: 35,  respawn: true,  blocksMovement: false, reach: 0 },
  mushroom:     { icon: "🍄", label: "버섯",       terrain: ["forest"],           cap: 28,  respawn: true,  blocksMovement: false, reach: 0 },
  rabbit:       { icon: "🐇", label: "토끼",       terrain: ["grass", "forest"],  cap: 16,  respawn: true,  blocksMovement: false, reach: 1 },
  flower:       { icon: "🌼", label: "들꽃",       terrain: ["grass"],            cap: 45,  respawn: true,  blocksMovement: false, reach: 0 },
  cave_entrance:{ icon: "⛏",  label: "동굴 입구", terrain: ["rock"],             cap: 1,   respawn: false, blocksMovement: false, reach: 1 },
  shipwreck:    { icon: "🚢", label: "난파선",     terrain: ["sand"],             cap: 1,   respawn: false, blocksMovement: true,  reach: 1 },
  cliff_lookout:{ icon: "🏔", label: "절벽 전망대",terrain: ["cliff_rock"],       cap: 1,   respawn: false, blocksMovement: false, reach: 1 },
  river_spring: { icon: "💧", label: "샘",         terrain: ["sand", "grass"],    cap: 2,   respawn: false, blocksMovement: false, reach: 1 },
  camp_spot:    { icon: "🏕", label: "거점 자리",  terrain: ["grass"],            cap: 1,   respawn: false, blocksMovement: false, reach: 0 },
  fishing_spot: { icon: "🎣", label: "낚시 포인트",terrain: ["sand", "grass"],    cap: 3,   respawn: false, blocksMovement: false, reach: 1 },
};
