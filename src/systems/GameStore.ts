import Phaser from "phaser";
import { TimeSystem } from "./TimeSystem";
import { PlayerStats } from "./PlayerStats";
import { Inventory } from "./Inventory";
import { Crafting } from "./Crafting";
import { SaveManager, type SaveBlob } from "./SaveManager";
import { WorldMap } from "./WorldMap";
import { LIGHT_RADIUS, LIGHT_SOURCE_TYPES } from "../data/tiles";
import type { EntityType } from "../data/tiles";
import type { WorldEntity } from "./WorldMap";
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
    this.crafting = new Crafting(this.inv, () => ({
      hasBonfire: this.isNearStructure("bonfire_placed", this.playerTx, this.playerTy),
      hasTent: this.isNearStructure("tent_placed", this.playerTx, this.playerTy),
    }));
    this.placePlayerAtStart();
    this.time.on("dayChange", () => this.save());
  }

  /** 좌표 (tx,ty)가 주어진 타입의 설치물로부터 LIGHT_RADIUS 이내에 있는가 (체비셰프 거리). */
  isNearStructure(type: EntityType, tx: number, ty: number, radius = LIGHT_RADIUS): boolean {
    return this.map.entities.some(
      (e) => e.type === type && Math.max(Math.abs(e.tx - tx), Math.abs(e.ty - ty)) <= radius
    );
  }

  /** 좌표 주변에 설치된 광원(모닥불/천막)이 있는지. 밤 밝음·몹 차단 체크용. */
  isInLightArea(tx: number, ty: number, radius = LIGHT_RADIUS): boolean {
    return this.map.entities.some(
      (e) =>
        LIGHT_SOURCE_TYPES.includes(e.type) &&
        Math.max(Math.abs(e.tx - tx), Math.abs(e.ty - ty)) <= radius
    );
  }

  /** 현재 맵의 모든 광원 엔티티 목록. */
  getLightSources(): WorldEntity[] {
    return this.map.entities.filter((e) => LIGHT_SOURCE_TYPES.includes(e.type));
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
    this.crafting = new Crafting(this.inv, () => ({
      hasBonfire: this.isNearStructure("bonfire_placed", this.playerTx, this.playerTy),
      hasTent: this.isNearStructure("tent_placed", this.playerTx, this.playerTy),
    }));
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
    this.migrateLegacyStructures();
  }

  /** 구버전 저장(전역 hasBonfire/hasTent 플래그)을 엔티티로 마이그레이션. */
  private migrateLegacyStructures(): void {
    const camp = this.map.entities.find((e) => e.type === "camp_spot");
    if (this.flags.hasBonfire && !this.map.entities.some((e) => e.type === "bonfire_placed")) {
      const spot = this.findLegacySpawnTile(camp, "bonfire_placed");
      if (spot) this.map.entities.push({ id: this.allocEntityId(), type: "bonfire_placed", tx: spot[0], ty: spot[1] });
    }
    if (this.flags.hasTent && !this.map.entities.some((e) => e.type === "tent_placed")) {
      const spot = this.findLegacySpawnTile(camp, "tent_placed");
      if (spot) this.map.entities.push({ id: this.allocEntityId(), type: "tent_placed", tx: spot[0], ty: spot[1] });
    }
  }

  private findLegacySpawnTile(camp: WorldEntity | undefined, _kind: EntityType): [number, number] | null {
    if (camp) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = camp.tx + dx;
        const ny = camp.ty + dy;
        if (this.map.in(nx, ny) && !this.map.entityAt(nx, ny)) return [nx, ny];
      }
    }
    if (this.map.in(this.playerTx, this.playerTy)) return [this.playerTx, this.playerTy];
    return null;
  }

  private allocEntityId(): number {
    let maxId = 0;
    for (const e of this.map.entities) if (e.id > maxId) maxId = e.id;
    return maxId + 1;
  }
}

export function getStore(scene: Phaser.Scene): GameStore {
  const existing = scene.game.registry.get("store") as GameStore | undefined;
  if (existing) return existing;
  const store = new GameStore();
  scene.game.registry.set("store", store);
  return store;
}
