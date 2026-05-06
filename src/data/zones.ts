import type { GameState, ZoneDef, ZoneId } from "../types";

export const ZONES: Record<ZoneId, ZoneDef> = {
  beach: {
    id: "beach",
    name: "해변",
    short: "🏖 해변",
    palette: { dayTop: 0x7ec8ff, dayBot: 0xfde7a8, nightTop: 0x091833, nightBot: 0x1a2a55 },
    decor: ["🌊", "🐚", "🏝", "🌴"],
    actions: ["look_around", "collect_shell", "fish"],
  },
  shipwreck: {
    id: "shipwreck",
    name: "좌초된 배",
    short: "🚢 잔해",
    palette: { dayTop: 0x4a617f, dayBot: 0x8a6b4a, nightTop: 0x0a1020, nightBot: 0x1a2438 },
    decor: ["🚢", "⚙", "🪵", "🧳"],
    actions: ["look_around", "loot_crate", "scrap_metal"],
  },
  forest: {
    id: "forest",
    name: "숲",
    short: "🌲 숲",
    palette: { dayTop: 0x6bbf6b, dayBot: 0x2d5a3a, nightTop: 0x0a1a10, nightBot: 0x15301e },
    decor: ["🌲", "🌳", "🍄", "🌿", "🐇"],
    actions: ["look_around", "gather_wood", "gather_berry", "gather_vine", "hunt"],
  },
  river: {
    id: "river",
    name: "강가",
    short: "🏞 강",
    palette: { dayTop: 0x9fe7ff, dayBot: 0x3a8bd1, nightTop: 0x0a1428, nightBot: 0x18325a },
    decor: ["🏞", "💧", "🐟", "🪨"],
    actions: ["look_around", "drink_water", "fish", "gather_stone"],
  },
  cave_entrance: {
    id: "cave_entrance",
    name: "동굴 입구",
    short: "🕳 동굴",
    palette: { dayTop: 0x6b6b6b, dayBot: 0x2b2b2b, nightTop: 0x101010, nightBot: 0x050505 },
    decor: ["🕳", "🪨", "🦇"],
    actions: ["look_around", "enter_cave", "gather_stone"],
  },
  cave_interior: {
    id: "cave_interior",
    name: "동굴 내부",
    short: "⛏ 광맥",
    palette: { dayTop: 0x2a2a2a, dayBot: 0x0f0f0f, nightTop: 0x0a0a0a, nightBot: 0x000000 },
    decor: ["⛏", "💎", "⛓"],
    actions: ["mine"],
  },
  cliff: {
    id: "cliff",
    name: "고지대",
    short: "🏔 절벽",
    palette: { dayTop: 0xa0c8ff, dayBot: 0x6e7a95, nightTop: 0x0a1428, nightBot: 0x20304f },
    decor: ["🏔", "🌬", "🦅", "🌅"],
    actions: ["look_around", "observe_sea"],
    unlock: (s: GameState) => s.inventory.some((slot) => slot?.id === "rope"),
  },
  camp: {
    id: "camp",
    name: "거점",
    short: "⛺ 거점",
    palette: { dayTop: 0xffd28a, dayBot: 0x7a5531, nightTop: 0x1c1310, nightBot: 0x3a2415 },
    decor: ["⛺", "🏕", "🔥"],
    actions: ["look_around", "sleep", "build_camp"],
    unlock: (s: GameState) => s.flags.hasTent || s.flags.hasBonfire,
  },
};

/** 각 지역에서 이동 가능한 목적지 */
export const ZONE_ADJACENCY: Record<ZoneId, ZoneId[]> = {
  beach: ["shipwreck", "forest", "river", "cliff", "camp"],
  shipwreck: ["beach"],
  forest: ["beach", "river", "cave_entrance", "camp"],
  river: ["beach", "forest", "cave_entrance"],
  cave_entrance: ["forest", "river", "cave_interior"],
  cave_interior: ["cave_entrance"],
  cliff: ["beach"],
  camp: ["beach", "forest"],
};
