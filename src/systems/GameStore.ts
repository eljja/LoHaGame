import Phaser from "phaser";
import { TimeSystem } from "./TimeSystem";
import { PlayerStats } from "./PlayerStats";
import { Inventory } from "./Inventory";
import { Crafting } from "./Crafting";
import { SaveManager, type SaveBlob } from "./SaveManager";
import { WorldMap } from "./WorldMap";
import type { GameState } from "../types";

/**
 * 모든 시스템과 게임 상태의 단일 소유자. Phaser game.registry에 'store'로 저장.
 */
export class GameStore extends Phaser.Events.EventEmitter {
  time = new TimeSystem();
  stats = new PlayerStats();
  inv = new Inventory();
  crafting: Crafting;

  /** 오픈월드 맵 */
  map: WorldMap = new WorldMap();
  /** 플레이어 타일 좌표 */
  playerTx = 0;
  playerTy = 0;

  flags: GameState["flags"] = {
    lootedCrates: 0,
    hasTent: false,
    hasBonfire: false,
    firstTimeVisited: {},
    bossesDefeated: [],
  };

  caveDepth: 0 | 1 | 2 | 3 = 0;

  /** 최근 로그 라인 */
  logs: string[] = [];

  constructor() {
    super();
    this.crafting = new Crafting(this.inv, () => ({ hasBonfire: this.flags.hasBonfire, hasTent: this.flags.hasTent }));
    this.placePlayerAtStart();
    this.time.on("dayChange", () => this.save());
  }

  private placePlayerAtStart(): void {
    // 시작 위치: 난파선 근처 해변에서 한 칸 안쪽
    const ship = this.map.entities.find((e) => e.type === "shipwreck");
    if (ship) {
      const candidates: Array<[number, number]> = [
        [ship.tx + 1, ship.ty],
        [ship.tx - 1, ship.ty],
        [ship.tx, ship.ty + 1],
        [ship.tx, ship.ty - 1],
      ];
      for (const [x, y] of candidates) {
        if (this.map.isPassable(x, y)) {
          this.playerTx = x;
          this.playerTy = y;
          return;
        }
      }
    }
    // 폴백: 중앙
    const c = Math.floor(this.map.size / 2);
    this.playerTx = c;
    this.playerTy = c;
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
    this.map = new WorldMap();
    this.placePlayerAtStart();
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
      caveDepth: this.caveDepth,
      map: this.map,
      playerTx: this.playerTx,
      playerTy: this.playerTy,
    });
  }

  loadFrom(blob: SaveBlob): void {
    this.time.fromJSON(blob.time);
    this.stats.fromJSON(blob.stats);
    this.inv.fromJSON(blob.inventory);
    this.flags = blob.flags;
    this.caveDepth = blob.caveDepth;
    if (blob.map) {
      this.map = WorldMap.fromJSON(blob.map);
    } else {
      this.map = new WorldMap();
    }
    if (blob.playerTx != null && blob.playerTy != null && this.map.in(blob.playerTx, blob.playerTy)) {
      this.playerTx = blob.playerTx;
      this.playerTy = blob.playerTy;
    } else {
      this.placePlayerAtStart();
    }
  }
}

export function getStore(scene: Phaser.Scene): GameStore {
  const existing = scene.game.registry.get("store") as GameStore | undefined;
  if (existing) return existing;
  const store = new GameStore();
  scene.game.registry.set("store", store);
  return store;
}
