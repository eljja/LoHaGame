import type { GameState } from "../types";
import type { Inventory } from "./Inventory";
import type { PlayerStats } from "./PlayerStats";
import type { TimeSystem } from "./TimeSystem";
import type { WorldMap, WorldMapSaveBlob } from "./WorldMap";
import { ITEMS } from "../data/items";
import { ENTITIES, WORLD_TILES } from "../data/tiles";
import { DAY_PHASE_SECONDS, NIGHT_PHASE_SECONDS, WIN_DAY } from "../config";

const KEY = "loha-save-v3";
const LEGACY_KEY = "loha-save-v2";

export interface SaveBlob {
  time: { day: number; hour: number; phase: "day" | "night"; elapsedInPhase: number };
  stats: { hp: number; hunger: number; thirst: number; energy: number };
  inventory: GameState["inventory"];
  equipped?: GameState["equipped"];
  flags: GameState["flags"];
  caveDepth: GameState["caveDepth"];
  map?: WorldMapSaveBlob;
  playerTx?: number;
  playerTy?: number;
  savedAt: number;
}

export const SaveManager = {
  save(data: {
    time: TimeSystem;
    stats: PlayerStats;
    inv: Inventory;
    equipped: GameState["equipped"];
    flags: GameState["flags"];
    caveDepth: GameState["caveDepth"];
    map: WorldMap;
    playerTx: number;
    playerTy: number;
  }): boolean {
    const blob: SaveBlob = {
      time: data.time.toJSON(),
      stats: data.stats.toJSON(),
      inventory: data.inv.toJSON(),
      equipped: data.equipped,
      flags: data.flags,
      caveDepth: data.caveDepth,
      map: data.map.toJSON(),
      playerTx: data.playerTx,
      playerTy: data.playerTy,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(blob));
      return true;
    } catch (e) {
      console.warn("save failed", e);
      return false;
    }
  },

  load(): SaveBlob | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return normalizeSaveBlob(parsed);
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem("loha-save-v1");
    } catch {
      /* ignore */
    }
  },

  hasSave(): boolean {
    try {
      return SaveManager.load() != null;
    } catch {
      return false;
    }
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSaveBlob(value: unknown): SaveBlob | null {
  if (!isRecord(value)) return null;
  const time = value.time;
  const stats = value.stats;
  if (!isRecord(time) || !isIntegerInRange(time.day, 1, WIN_DAY + 1) || !isIntegerInRange(time.hour, 0, 23) || !isNumber(time.elapsedInPhase)) return null;
  if (time.phase !== "day" && time.phase !== "night") return null;
  const phaseSeconds = time.phase === "day" ? DAY_PHASE_SECONDS : NIGHT_PHASE_SECONDS;
  if (time.elapsedInPhase < 0 || time.elapsedInPhase >= phaseSeconds) return null;
  if (!isRecord(stats) || !isStat(stats.hp) || !isStat(stats.hunger) || !isStat(stats.thirst) || !isStat(stats.energy)) return null;
  if (!Array.isArray(value.inventory) || value.inventory.length > 500 || !isInventory(value.inventory)) return null;
  if (!isRecord(value.flags)) return null;
  if (value.caveDepth !== 0 && value.caveDepth !== 1 && value.caveDepth !== 2 && value.caveDepth !== 3) return null;
  if (value.map !== undefined && !isWorldMapBlob(value.map)) return null;
  if (value.playerTx !== undefined && !isIntegerInRange(value.playerTx, 0, WORLD_TILES - 1)) return null;
  if (value.playerTy !== undefined && !isIntegerInRange(value.playerTy, 0, WORLD_TILES - 1)) return null;
  if (value.savedAt !== undefined && !isNumber(value.savedAt)) return null;
  const equipped = normalizeEquipment(value.equipped);
  return {
    ...(value as unknown as Omit<SaveBlob, "savedAt">),
    equipped,
    savedAt: isNumber(value.savedAt) ? value.savedAt : 0,
  };
}

function normalizeEquipment(value: unknown): GameState["equipped"] | undefined {
  if (!isRecord(value)) return undefined;
  const equipped: GameState["equipped"] = {};
  for (const key of ["weapon", "shield", "pickaxe"] as const) {
    const id = value[key];
    if (typeof id === "string" && id in ITEMS) equipped[key] = id as GameState["equipped"][typeof key];
  }
  if (isIntegerInRange(value.weaponSlot, 0, 499)) equipped.weaponSlot = value.weaponSlot;
  if (isIntegerInRange(value.shieldSlot, 0, 499)) equipped.shieldSlot = value.shieldSlot;
  return equipped;
}

function isInventory(value: unknown[]): boolean {
  return value.every((slot) => {
    if (slot === null) return true;
    if (!isRecord(slot)) return false;
    if (typeof slot.id !== "string" || !(slot.id in ITEMS) || !isIntegerInRange(slot.count, 1, 9999)) return false;
    return slot.dur === undefined || (isNumber(slot.dur) && slot.dur > 0 && slot.dur <= 10000);
  });
}

function isWorldMapBlob(value: unknown): value is WorldMapSaveBlob {
  if (!isRecord(value) || !isNumber(value.seed) || !Number.isInteger(value.seed) || !isNumber(value.nextId) || !Number.isInteger(value.nextId) || !Array.isArray(value.entities) || value.entities.length > 2000) return false;
  if (value.profile !== undefined && typeof value.profile !== "string") return false;
  const valid = value.entities.every((entity) => {
    if (!isRecord(entity)) return false;
    if (!isIntegerInRange(entity.id, 1, Number.MAX_SAFE_INTEGER) || typeof entity.type !== "string" || !(entity.type in ENTITIES)) return false;
    if (!isIntegerInRange(entity.tx, 0, WORLD_TILES - 1) || !isIntegerInRange(entity.ty, 0, WORLD_TILES - 1)) return false;
    return true;
  });
  return valid && value.nextId >= 1;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isStat(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 100;
}
