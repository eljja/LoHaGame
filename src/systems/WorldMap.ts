import { ENTITIES, TERRAIN, WORLD_TILES, type EntityType, type TerrainType } from "../data/tiles";

export interface WorldEntity {
  id: number;
  type: EntityType;
  tx: number;
  ty: number;
  /** 상자 수색 횟수 등 */
  meta?: { lootLeft?: number };
}

export interface WorldMapSaveBlob {
  seed: number;
  entities: WorldEntity[];
  nextId: number;
}

/** 결정적 PRNG (Mulberry32) */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WorldMap {
  readonly size = WORLD_TILES;
  terrain: TerrainType[][] = [];
  entities: WorldEntity[] = [];
  seed: number;
  private nextId = 1;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2 ** 31);
    this.generateTerrain();
    this.seedEntities();
  }

  // ── 지형 생성 ──
  private generateTerrain(): void {
    const rnd = mulberry32(this.seed);
    const N = this.size;
    const cx = (N - 1) / 2;
    const cy = (N - 1) / 2;
    // 비례 상수: N=64 기준 → islandR≈27, beachR≈29.6
    const islandR = N * 0.422;
    const beachR  = N * 0.463;

    const forestNoise: number[][] = [];
    for (let y = 0; y < N; y++) {
      forestNoise.push([]);
      for (let x = 0; x < N; x++) {
        forestNoise[y].push(rnd());
      }
    }

    // 강: 북→남 가로지르는 곡선 (시드 기반 오프셋)
    const riverOffsets: number[] = [];
    const baseRiverX = Math.floor(N * 0.32);
    for (let y = 0; y < N; y++) {
      const wave = Math.sin(y * 0.18 + rnd() * 0.3) * 3 + rnd() * 1.2 - 0.6;
      riverOffsets.push(Math.round(baseRiverX + wave));
    }

    this.terrain = [];
    for (let y = 0; y < N; y++) {
      const row: TerrainType[] = [];
      for (let x = 0; x < N; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);

        let t: TerrainType;
        if (d > beachR + 1.5) t = "deep_water";
        else if (d > beachR) t = "shallow_water";
        else if (d > islandR) t = "sand";
        else {
          // 섬 내부: 중심부는 숲 많고 가장자리는 풀
          const nz = forestNoise[y][x];
          const forestBias = d < N * 0.25 ? 0.55 : 0.4;
          t = nz > 1 - forestBias ? "forest" : "grass";
        }
        row.push(t);
      }
      this.terrain.push(row);
    }

    // 돌산 (동굴 입구용): 북서 영역
    const rockCenter = { x: Math.floor(N * 0.3), y: Math.floor(N * 0.25) };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.sqrt((x - rockCenter.x) ** 2 + (y - rockCenter.y) ** 2);
        if (d < N * 0.07 && this.in(x, y) && this.terrain[y][x] !== "deep_water" && this.terrain[y][x] !== "shallow_water") {
          this.terrain[y][x] = "rock";
        }
      }
    }

    // 절벽 (고지대): 동북 영역
    const cliffCenter = { x: Math.floor(N * 0.78), y: Math.floor(N * 0.24) };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.sqrt((x - cliffCenter.x) ** 2 + (y - cliffCenter.y) ** 2);
        if (d < N * 0.056 && this.in(x, y) && this.terrain[y][x] !== "deep_water" && this.terrain[y][x] !== "shallow_water") {
          this.terrain[y][x] = "cliff_rock";
        }
      }
    }

    // 강 덧그리기 (섬 내부에서만, 2~3칸 폭)
    for (let y = 0; y < N; y++) {
      const rx = riverOffsets[y];
      const widths = [0, 1]; // 기본 2칸 폭
      if (rnd() > 0.5) widths.push(2); // 가끔 3칸
      for (const w of widths) {
        const x = rx + w;
        if (this.in(x, y)) {
          const base = this.terrain[y][x];
          if (base === "grass" || base === "forest" || base === "sand") {
            this.terrain[y][x] = "river";
          }
        }
      }
    }
  }

  // ── 엔티티 초기 배치 ──
  private seedEntities(): void {
    this.entities = [];
    this.nextId = 1;
    const rnd = mulberry32(this.seed ^ 0x9e37);
    const N = this.size;

    // POI 먼저
    this.placePoi("cave_entrance", rnd);
    this.placePoi("cliff_lookout", rnd);
    this.placePoi("shipwreck", rnd, (tx, ty) => this.isCoastalSand(tx, ty));
    this.placePoi("camp_spot", rnd, (tx, ty) =>
      this.distFromCenter(tx, ty) < N * 0.188 && this.terrain[ty][tx] === "grass"
    );
    this.placePoi("river_spring", rnd, (tx, ty) => this.adjacentTo(tx, ty, "river"));
    this.placePoi("river_spring", rnd, (tx, ty) => this.adjacentTo(tx, ty, "river"));
    // 낚시 포인트: 강 옆 2군데 + 해변 1군데
    this.placePoi("fishing_spot", rnd, (tx, ty) => this.adjacentTo(tx, ty, "river"));
    this.placePoi("fishing_spot", rnd, (tx, ty) => this.adjacentTo(tx, ty, "river"));
    this.placePoi("fishing_spot", rnd, (tx, ty) => this.terrain[ty][tx] === "sand" && this.adjacentTo(tx, ty, "shallow_water"));

    // 자원 리스폰
    this.nightRespawn();
  }

  private placePoi(type: EntityType, rnd: () => number, filter?: (tx: number, ty: number) => boolean): void {
    const def = ENTITIES[type];
    for (let attempt = 0; attempt < 600; attempt++) {
      const tx = Math.floor(rnd() * this.size);
      const ty = Math.floor(rnd() * this.size);
      if (!this.in(tx, ty)) continue;
      const t = this.terrain[ty][tx];
      if (!def.terrain.includes(t)) continue;
      if (this.entityAt(tx, ty)) continue;
      if (filter && !filter(tx, ty)) continue;
      this.entities.push({ id: this.nextId++, type, tx, ty, meta: type === "shipwreck" ? { lootLeft: 3 } : undefined });
      return;
    }
  }

  private isCoastalSand(tx: number, ty: number): boolean {
    if (!this.in(tx, ty)) return false;
    if (this.terrain[ty][tx] !== "sand") return false;
    const ns: Array<[number, number]> = [
      [tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1],
    ];
    return ns.some(([x, y]) => this.in(x, y) && (this.terrain[y][x] === "shallow_water" || this.terrain[y][x] === "deep_water"));
  }

  private adjacentTo(tx: number, ty: number, t: TerrainType): boolean {
    const ns: Array<[number, number]> = [
      [tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1],
    ];
    return ns.some(([x, y]) => this.in(x, y) && this.terrain[y][x] === t);
  }

  private distFromCenter(tx: number, ty: number): number {
    const c = (this.size - 1) / 2;
    return Math.sqrt((tx - c) ** 2 + (ty - c) ** 2);
  }

  in(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.size && ty < this.size;
  }

  terrainAt(tx: number, ty: number): TerrainType | null {
    if (!this.in(tx, ty)) return null;
    return this.terrain[ty][tx];
  }

  entityAt(tx: number, ty: number): WorldEntity | null {
    return this.entities.find((e) => e.tx === tx && e.ty === ty) ?? null;
  }

  /** 플레이어가 해당 타일로 이동 가능한가 */
  isPassable(tx: number, ty: number): boolean {
    if (!this.in(tx, ty)) return false;
    const t = this.terrain[ty][tx];
    if (!TERRAIN[t].walkable) return false;
    const e = this.entityAt(tx, ty);
    if (e && ENTITIES[e.type].blocksMovement) return false;
    return true;
  }

  /** 플레이어 위치 기준 상호작용 가능한 엔티티 반환 */
  reachableEntity(playerTx: number, playerTy: number, targetTx: number, targetTy: number): WorldEntity | null {
    const e = this.entityAt(targetTx, targetTy);
    if (!e) return null;
    const def = ENTITIES[e.type];
    const dx = Math.abs(targetTx - playerTx);
    const dy = Math.abs(targetTy - playerTy);
    if (def.reach === 0) {
      if (dx === 0 && dy === 0) return e;
      if (dx + dy === 1) return e;
      return null;
    }
    if (dx <= 1 && dy <= 1 && dx + dy <= 2) return e;
    return null;
  }

  removeEntity(id: number): void {
    const idx = this.entities.findIndex((e) => e.id === id);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  /** 매일 낮이 될 때 호출. 캡까지 부족한 자원을 다시 흩뿌린다. */
  nightRespawn(): number {
    const rnd = mulberry32((this.seed ^ 0x2b85) + this.entities.length + this.nextId);
    let spawned = 0;
    for (const [type, def] of Object.entries(ENTITIES) as Array<[EntityType, typeof ENTITIES[EntityType]]>) {
      if (!def.respawn) continue;
      const current = this.entities.filter((e) => e.type === type).length;
      const toSpawn = Math.max(0, def.cap - current);
      for (let i = 0; i < toSpawn; i++) {
        if (!this.trySpawn(type, rnd)) break;
        spawned++;
      }
    }
    return spawned;
  }

  private trySpawn(type: EntityType, rnd: () => number): boolean {
    const def = ENTITIES[type];
    for (let a = 0; a < 100; a++) {
      const tx = Math.floor(rnd() * this.size);
      const ty = Math.floor(rnd() * this.size);
      if (!this.in(tx, ty)) continue;
      const t = this.terrain[ty][tx];
      if (!def.terrain.includes(t)) continue;
      if (this.entityAt(tx, ty)) continue;
      this.entities.push({ id: this.nextId++, type, tx, ty });
      return true;
    }
    return false;
  }

  toJSON(): WorldMapSaveBlob {
    return { seed: this.seed, entities: this.entities.map((e) => ({ ...e })), nextId: this.nextId };
  }

  static fromJSON(b: WorldMapSaveBlob): WorldMap {
    const m = new WorldMap(b.seed);
    m.entities = b.entities.map((e) => ({ ...e }));
    m.nextId = b.nextId;
    return m;
  }
}
