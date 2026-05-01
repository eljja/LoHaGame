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
import type { GameState, ItemId } from "../types";
import { ACHIEVEMENTS, type Achievement } from "../data/achievements";
import { RECIPE_UNLOCK_TRIGGERS } from "../data/recipes";

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
    unlockedAchievements: [],
    discoveredRecipes: [
      "wood_club", "stone_axe", "stone_spear", "rope", "torch",
      "stone_pickaxe", "bandage", "bonfire", "tent",
    ],
    fishCaught: 0,
  };

  caveDepth: 0 | 1 | 2 | 3 = 0;

  /** 최근 로그 라인 */
  logs: string[] = [];

  constructor() {
    super();
    this.crafting = new Crafting(this.inv, () => ({
      hasBonfire: this.isNearStructure("bonfire_placed", this.playerTx, this.playerTy),
      hasTent: this.isNearStructure("tent_placed", this.playerTx, this.playerTy),
      discoveredRecipes: this.flags.discoveredRecipes,
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

  // ── Achievement system ────────────────────────────────────────────

  hasAchievement(id: string): boolean {
    return (this.flags.unlockedAchievements ?? []).includes(id);
  }

  unlockAchievement(id: string): void {
    if (this.hasAchievement(id)) return;
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return;
    (this.flags.unlockedAchievements ??= []).push(id);
    this.pushLog(`🏆 도전 과제 달성: ${ach.icon} ${ach.name}${ach.perk ? ` — ${ach.perk.desc}` : ""}`);
    this.emit("achievement", ach);
    this.updatePerkMultipliers();
  }

  checkTimedAchievements(): void {
    if (this.time.day >= 25) this.unlockAchievement("day25");
    if ((this.flags.bossesDefeated ?? []).length >= 3) this.unlockAchievement("boss_x3");
  }

  private updatePerkMultipliers(): void {
    let hungerMult = 1.0;
    if (this.hasAchievement("first_fire")) hungerMult *= 0.9;
    if (this.hasAchievement("master_chef")) hungerMult *= 0.85;
    this.stats.hungerMult = hungerMult;

    let energyMult = 1.0;
    if (this.hasAchievement("day25")) energyMult *= 0.9;
    if (this.hasAchievement("stargazer")) energyMult *= 0.5;
    this.stats.energyMult = energyMult;
  }

  // ── Perk getters ────────────────────────────────────────────────

  /** 채집 시 10% 확률로 아이템 +1 (first_hunt 특성) */
  get perkGatherBonus(): number {
    return this.hasAchievement("first_hunt") ? 0.10 : 0;
  }

  /** 전투 공격력 보너스 (boss_x3 특성) */
  get perkBonusDmg(): number {
    return this.hasAchievement("boss_x3") ? 5 : 0;
  }

  /** 잠 잘 때 HP 회복 보너스 (cave_floor3 특성) */
  get perkBonusRestHp(): number {
    return this.hasAchievement("cave_floor3") ? 10 : 0;
  }

  /** 낚시 판정 시간 보너스(ms) (fish5 특성) */
  get perkFishExtraMs(): number {
    return this.hasAchievement("fish5") ? 500 : 0;
  }

  /** 희귀 드롭 보너스 확률 (treasure_dug 특성) */
  get perkRareDropBonus(): number {
    return this.hasAchievement("treasure_dug") ? 0.05 : 0;
  }

  // ── Recipe discovery ─────────────────────────────────────────────

  /** 아이템을 처음 획득할 때 호출. 새로 해금된 레시피 id 목록을 반환하고 이벤트를 발생시킨다. */
  discoverRecipes(itemId: ItemId): string[] {
    const discovered = this.flags.discoveredRecipes;
    const newOnes: string[] = [];
    const recipeIds = RECIPE_UNLOCK_TRIGGERS[itemId];
    if (recipeIds) {
      for (const recipeId of recipeIds) {
        if (!discovered.includes(recipeId)) {
          discovered.push(recipeId);
          newOnes.push(recipeId);
        }
      }
    }
    if (newOnes.length > 0) this.emit("recipesDiscovered", newOnes);
    return newOnes;
  }

  // ── Spatial Combos ──────────────────────────────────────────────
  // 설치물 인접 패턴이 자동 발동하는 보너스. 엔티티 변동 시 recomputeCombos() 재호출.
  //  - forge: 모닥불 + 인접 8칸에 돌무더기 3개 이상 → 돌무더기 채집 ×2
  //  - home_base: 천막과 모닥불이 2칸 이내에 모두 존재 → 잠자기 HP +30
  //  - farm: 씨앗(planted/ripe) 4개가 3x3 안에 존재 → 씨앗 1일 빠르게 성장
  //  - signal_network: 점화된 봉화 3개 이상 → 다음 해양 보스 HP/atk ×0.75

  /** 현재 활성화된 콤보 id 집합 (휘발성 — 엔티티에서 매번 재계산). */
  activeCombos: Set<"forge" | "home_base" | "farm" | "signal_network"> = new Set();

  /** 엔티티가 변할 때마다 호출. 활성 콤보를 다시 계산한다.
   *  silent=true면 발동/해제 로그를 출력하지 않음 (초기/로드 시 사용). */
  recomputeCombos(silent = false): void {
    const before = new Set(this.activeCombos);
    const next = new Set<"forge" | "home_base" | "farm" | "signal_network">();

    const ents = this.map.entities;
    const bonfires = ents.filter((e) => e.type === "bonfire_placed");
    const tents = ents.filter((e) => e.type === "tent_placed");
    const stones = ents.filter((e) => e.type === "stone_outcrop");
    const seeds = ents.filter((e) => e.type === "planted_seed" || e.type === "ripe_plant");
    const litFires = ents.filter((e) => e.type === "signal_fire_lit");

    // forge: 어떤 모닥불 주변 8칸 안에 stone_outcrop 3개 이상
    for (const bf of bonfires) {
      const cnt = stones.filter(
        (s) => Math.max(Math.abs(s.tx - bf.tx), Math.abs(s.ty - bf.ty)) <= 1
      ).length;
      if (cnt >= 3) { next.add("forge"); break; }
    }

    // home_base: 천막 ↔ 모닥불 체비셰프 거리 2 이내
    outer: for (const tent of tents) {
      for (const bf of bonfires) {
        if (Math.max(Math.abs(tent.tx - bf.tx), Math.abs(tent.ty - bf.ty)) <= 2) {
          next.add("home_base"); break outer;
        }
      }
    }

    // farm: 어떤 씨앗을 중심으로 3x3(체비셰프 1) 영역 안에 씨앗 4개 이상
    for (const seed of seeds) {
      const cnt = seeds.filter(
        (s) => Math.max(Math.abs(s.tx - seed.tx), Math.abs(s.ty - seed.ty)) <= 1
      ).length;
      if (cnt >= 4) { next.add("farm"); break; }
    }

    // signal_network: 점화된 봉화 3개 이상
    if (litFires.length >= 3) next.add("signal_network");

    this.activeCombos = next;

    // 새로 켜진 콤보가 있으면 로그
    const labels: Record<string, string> = {
      forge: "🏭 화로 가동! (모닥불 + 돌무더기 3개) 돌 채집 ×2",
      home_base: "🏠 거점 연결! (천막 + 모닥불) 잠자기 HP +30",
      farm: "🌾 텃밭 형성! (씨앗 4개) 성장 1일 단축",
      signal_network: "📡 봉화망 가동! (점화된 봉화 3개) 다음 보스 약화",
    };
    if (!silent) {
      for (const id of next) {
        if (!before.has(id)) this.pushLog(labels[id]);
      }
      for (const id of before) {
        if (!next.has(id)) this.pushLog(`💨 콤보 해제: ${id}`);
      }
    }
    if (next.size !== before.size || [...next].some((c) => !before.has(c))) {
      this.emit("combosChanged", next);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  private placePlayerAtStart(): void {
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
      unlockedAchievements: [],
      discoveredRecipes: [
        "wood_club", "stone_axe", "stone_spear", "rope", "torch",
        "stone_pickaxe", "bandage", "bonfire", "tent",
      ],
      fishCaught: 0,
    };
    this.crafting = new Crafting(this.inv, () => ({
      hasBonfire: this.isNearStructure("bonfire_placed", this.playerTx, this.playerTy),
      hasTent: this.isNearStructure("tent_placed", this.playerTx, this.playerTy),
      discoveredRecipes: this.flags.discoveredRecipes,
    }));
    this.map = new WorldMap();
    this.placePlayerAtStart();
    this.caveDepth = 0;
    this.logs = [];
    this.activeCombos = new Set();
    this.recomputeCombos(true); // 신규 게임은 콤보 없을 것이지만 명시적으로 동기화
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
    // backwards compatibility for older saves
    if (!this.flags.unlockedAchievements) this.flags.unlockedAchievements = [];
    if (!this.flags.discoveredRecipes) {
      this.flags.discoveredRecipes = [
        "wood_club", "stone_axe", "stone_spear", "rope", "torch",
        "stone_pickaxe", "bandage", "bonfire", "tent",
      ];
    }
    if (this.flags.fishCaught == null) this.flags.fishCaught = 0;

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
    this.updatePerkMultipliers();
    this.activeCombos = new Set();
    this.recomputeCombos(true); // 로드 시 silent로 콤보 동기화 (로그 스팸 방지)
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
