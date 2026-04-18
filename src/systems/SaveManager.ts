import type { GameState } from "../types";
import type { Inventory } from "./Inventory";
import type { PlayerStats } from "./PlayerStats";
import type { TimeSystem } from "./TimeSystem";

const KEY = "loha-save-v1";

export interface SaveBlob {
  time: { day: number; hour: number; phase: "day" | "night"; elapsedInPhase: number };
  stats: { hp: number; hunger: number; thirst: number; energy: number };
  inventory: GameState["inventory"];
  flags: GameState["flags"];
  currentZone: GameState["currentZone"];
  caveDepth: GameState["caveDepth"];
  savedAt: number;
}

export const SaveManager = {
  save(data: {
    time: TimeSystem;
    stats: PlayerStats;
    inv: Inventory;
    flags: GameState["flags"];
    currentZone: GameState["currentZone"];
    caveDepth: GameState["caveDepth"];
  }): void {
    const blob: SaveBlob = {
      time: data.time.toJSON(),
      stats: data.stats.toJSON(),
      inventory: data.inv.toJSON(),
      flags: data.flags,
      currentZone: data.currentZone,
      caveDepth: data.caveDepth,
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
    } catch {
      /* ignore */
    }
  },

  hasSave(): boolean {
    return localStorage.getItem(KEY) != null;
  },
};
