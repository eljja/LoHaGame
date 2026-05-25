import type { GameState } from "../types";
import type { Inventory } from "./Inventory";
import type { PlayerStats } from "./PlayerStats";
import type { TimeSystem } from "./TimeSystem";
import type { WorldMap, WorldMapSaveBlob } from "./WorldMap";
import { ITEMS } from "../data/items";
import { ENTITIES } from "../data/tiles";

const KEY = "loha-save-v3";
const LEGACY_KEY = "loha-save-v2";

export interface SaveBlob {
  time: { day: number; hour: number; phase: "day" | "night"; elapsedInPhase: number };
  stats: { hp: number; hunger: number; thirst: number; energy: number };
  inventory: GameState["inventory"];
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
    flags: GameState["flags"];
    caveDepth: GameState["caveDepth"];
    map: WorldMap;
    playerTx: number;
    playerTy: number;
  }): void {
    const blob: SaveBlob = {
      time: data.time.toJSON(),
      stats: data.stats.toJSON(),
      inventory: data.inv.toJSON(),
      flags: data.flags,
      caveDepth: data.caveDepth,
      map: data.map.toJSON(),
      playerTx: data.playerTx,
      playerTy: data.playerTy,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(blob));
    } catch (e) {
      console.warn("save failed", e);
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
  if (!isRecord(time) || !isNumber(time.day) || !isNumber(time.hour) || !isNumber(time.elapsedInPhase)) return null;
  if (time.phase !== "day" && time.phase !== "night") return null;
  if (!isRecord(stats) || !isNumber(stats.hp) || !isNumber(stats.hunger) || !isNumber(stats.thirst) || !isNumber(stats.energy)) return null;
  if (!Array.isArray(value.inventory) || !isInventory(value.inventory)) return null;
  if (!isRecord(value.flags)) return null;
  if (value.caveDepth !== 0 && value.caveDepth !== 1 && value.caveDepth !== 2 && value.caveDepth !== 3) return null;
  if (value.map !== undefined && !isWorldMapBlob(value.map)) return null;
  if (value.playerTx !== undefined && !isNumber(value.playerTx)) return null;
  if (value.playerTy !== undefined && !isNumber(value.playerTy)) return null;
  if (value.savedAt !== undefined && !isNumber(value.savedAt)) return null;
  return {
    ...(value as unknown as Omit<SaveBlob, "savedAt">),
    savedAt: isNumber(value.savedAt) ? value.savedAt : 0,
  };
}

function isInventory(value: unknown[]): boolean {
  return value.every((slot) => {
    if (slot === null) return true;
    if (!isRecord(slot)) return false;
    return typeof slot.id === "string" && slot.id in ITEMS && isNumber(slot.count) && slot.count > 0;
  });
}

function isWorldMapBlob(value: unknown): value is WorldMapSaveBlob {
  if (!isRecord(value) || !isNumber(value.seed) || !isNumber(value.nextId) || !Array.isArray(value.entities)) return false;
  return value.entities.every((entity) => {
    if (!isRecord(entity)) return false;
    return isNumber(entity.id) && typeof entity.type === "string" && entity.type in ENTITIES && isNumber(entity.tx) && isNumber(entity.ty);
  });
}
