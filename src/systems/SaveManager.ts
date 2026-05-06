import type { GameState } from "../types";
import type { Inventory } from "./Inventory";
import type { PlayerStats } from "./PlayerStats";
import type { TimeSystem } from "./TimeSystem";
import type { WorldMap, WorldMapSaveBlob } from "./WorldMap";

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
      return JSON.parse(raw) as SaveBlob;
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
    return localStorage.getItem(KEY) != null;
  },
};
