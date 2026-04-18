import Phaser from "phaser";
import { TimeSystem } from "./TimeSystem";
import { PlayerStats } from "./PlayerStats";
import { Inventory } from "./Inventory";
import { Crafting } from "./Crafting";
import { SaveManager, type SaveBlob } from "./SaveManager";
import type { GameState, ZoneId } from "../types";

/**
 * 모든 시스템과 게임 상태의 단일 소유자. Phaser game.registry에 'store'로 저장.
 */
export class GameStore extends Phaser.Events.EventEmitter {
  time = new TimeSystem();
  stats = new PlayerStats();
  inv = new Inventory();
  crafting: Crafting;

  flags: GameState["flags"] = {
    lootedCrates: 0,
    hasTent: false,
    hasBonfire: false,
    firstTimeVisited: {},
    bossesDefeated: [],
  };

  currentZone: ZoneId = "beach";
  caveDepth: 0 | 1 | 2 | 3 = 0;

  /** 최근 로그 라인 */
  logs: string[] = [];

  constructor() {
    super();
    this.crafting = new Crafting(this.inv, () => ({ hasBonfire: this.flags.hasBonfire, hasTent: this.flags.hasTent }));
    this.time.on("dayChange", () => this.save());
  }

  pushLog(msg: string): void {
    this.logs.unshift(msg);
    if (this.logs.length > 40) this.logs.length = 40;
    this.emit("log", msg);
  }

  resetNewGame(): void {
    this.time = new TimeSystem();
    this.stats = new PlayerStats();
    this.inv = new Inventory();
    this.flags = {
      lootedCrates: 0,
      hasTent: false,
      hasBonfire: false,
      firstTimeVisited: {},
      bossesDefeated: [],
    };
    this.crafting = new Crafting(this.inv, () => ({ hasBonfire: this.flags.hasBonfire, hasTent: this.flags.hasTent }));
    this.currentZone = "beach";
    this.caveDepth = 0;
    this.logs = [];
    this.time.on("dayChange", () => this.save());
    this.emit("reset");
  }

  save(): void {
    SaveManager.save({
      time: this.time,
      stats: this.stats,
      inv: this.inv,
      flags: this.flags,
      currentZone: this.currentZone,
      caveDepth: this.caveDepth,
    });
  }

  loadFrom(blob: SaveBlob): void {
    this.time.fromJSON(blob.time);
    this.stats.fromJSON(blob.stats);
    this.inv.fromJSON(blob.inventory);
    this.flags = blob.flags;
    this.currentZone = blob.currentZone;
    this.caveDepth = blob.caveDepth;
  }
}

export function getStore(scene: Phaser.Scene): GameStore {
  const existing = scene.game.registry.get("store") as GameStore | undefined;
  if (existing) return existing;
  const store = new GameStore();
  scene.game.registry.set("store", store);
  return store;
}
