import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, WIN_DAY } from "../config";
import { TERRAIN, ENTITIES, TILE_PX, WORLD_PX } from "../data/tiles";
import { ITEMS } from "../data/items";
import { SEA_BOSSES, NIGHT_MOBS, DAY_GAME } from "../data/enemies";
import type { EnemyDef } from "../types";
import { getStore } from "../systems/GameStore";
import type { WorldEntity } from "../systems/WorldMap";
import { makeButton } from "../ui/Button";
import { InventoryPanel } from "../ui/InventoryPanel";
import { CraftingPanel } from "../ui/CraftingPanel";
import { JournalPanel } from "../ui/JournalPanel";
import { audio } from "../systems/AudioManager";

// Viewport constants
const VP_X = 0;
const VP_Y = 56;
const VP_W = GAME_WIDTH;
const VP_H = 552; // 56..608

export class WorldScene extends Phaser.Scene {
  // World-space objects (followed by main camera)
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private entityObjects: Map<number, Phaser.GameObjects.Text> = new Map();
  private playerSprite!: Phaser.GameObjects.Text;
  private playerShadow!: Phaser.GameObjects.Ellipse;

  // UI-space objects (UI camera)
  private uiContainer!: Phaser.GameObjects.Container;
  private actionHintText!: Phaser.GameObjects.Text;
  private menuBar!: Phaser.GameObjects.Container;
  private dpad!: Phaser.GameObjects.Container;

  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;
  private journalPanel!: JournalPanel;

  // Cameras
  private worldCam!: Phaser.Cameras.Scene2D.Camera;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  // World object layer (tagged so UI cam can ignore them)
  private worldObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("WorldScene");
  }

  create(): void {
    const store = getStore(this);

    // ── Cameras ──────────────────────────────────────────
    // Main (world) camera: shows the tile world
    this.worldCam = this.cameras.main;
    this.worldCam.setViewport(VP_X, VP_Y, VP_W, VP_H);
    this.worldCam.setBounds(0, 0, WORLD_PX, WORLD_PX);

    // UI camera: full screen, sits on top
    this.uiCam = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.worldCam.fadeIn(500, 0, 0, 0);

    // ── World objects ─────────────────────────────────────
    this.terrainGfx = this.add.graphics();
    this.worldObjects.push(this.terrainGfx);

    // Player shadow (elliptical, world space, behind player)
    const playerShadow = this.add
      .ellipse(
        store.playerTx * TILE_PX + TILE_PX / 2,
        store.playerTy * TILE_PX + TILE_PX / 2 + 10,
        22, 8, 0x000000, 0.35
      )
      .setDepth(9);
    this.worldObjects.push(playerShadow);
    this.playerShadow = playerShadow;

    // Player sprite (world space)
    this.playerSprite = this.add
      .text(
        store.playerTx * TILE_PX + TILE_PX / 2,
        store.playerTy * TILE_PX + TILE_PX / 2,
        "🧑",
        { fontSize: "28px" }
      )
      .setOrigin(0.5)
      .setDepth(10);
    this.worldObjects.push(this.playerSprite);

    // 플레이어 가벼운 호흡 애니메이션 (원래 위치 추적 방해 없이 스케일만)
    this.tweens.add({
      targets: this.playerSprite,
      scaleY: 1.04,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    // Camera follow player with lerp
    this.worldCam.startFollow(this.playerSprite, true, 0.1, 0.1);

    // ── UI Container ──────────────────────────────────────
    this.uiContainer = this.add.container(0, 0).setDepth(50);

    // Bottom panel background
    const bottomBg = this.add.rectangle(0, 608, GAME_WIDTH, 192, 0x060a18, 0.95).setOrigin(0, 0);
    this.uiContainer.add(bottomBg);

    // Action hint text (left side of bottom UI)
    this.actionHintText = this.add.text(20, 624, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#9fb7ff",
      wordWrap: { width: 700 },
    });
    this.uiContainer.add(this.actionHintText);

    // Build D-pad and menu bar
    this.dpad = this.add.container(0, 0);
    this.buildDpad();
    this.uiContainer.add(this.dpad);

    this.menuBar = this.add.container(0, 0);
    this.buildMenuBar();
    this.uiContainer.add(this.menuBar);

    // Panels
    this.inventoryPanel = new InventoryPanel(this);
    this.craftingPanel = new CraftingPanel(this);
    this.journalPanel = new JournalPanel(this);

    // ── UI Camera ignores world objects ───────────────────
    this.uiCam.ignore(this.worldObjects);

    // ── Render world ──────────────────────────────────────
    this.renderTerrain();
    this.renderEntities();
    this.updateActionHint();

    // ── Event bindings ────────────────────────────────────
    store.time.on("phaseChange", (phase: "day" | "night") => {
      audio.play(phase === "day" ? "phase_day" : "phase_night");
      this.syncBgm();
      if (phase === "day") {
        const count = store.map.nightRespawn();
        this.renderEntities();
        store.pushLog(`☀ 새벽이 밝아왔다. 자원 ${count}개가 재생됐다.`);
      }
    });

    store.time.on("dayChange", (d: number) => {
      store.pushLog(`☀ Day ${d}가 밝았다.`);
      if (d > WIN_DAY) {
        this.scene.stop("HUDScene");
        this.scene.start("VictoryScene");
      }
    });

    store.time.on("day10Tick", (d: number) => this.triggerSeaBoss(d));

    store.stats.on("death", () => {
      this.scene.stop("HUDScene");
      this.scene.start("GameOverScene");
    });

    this.syncBgm();
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.syncBgm();
      this.renderEntities();
      this.updateActionHint();
    });

    // ── Keyboard ──────────────────────────────────────────
    this.input.keyboard?.on("keydown-UP", () => this.tryMove(0, -1));
    this.input.keyboard?.on("keydown-DOWN", () => this.tryMove(0, 1));
    this.input.keyboard?.on("keydown-LEFT", () => this.tryMove(-1, 0));
    this.input.keyboard?.on("keydown-RIGHT", () => this.tryMove(1, 0));
    this.input.keyboard?.on("keydown-I", () => this.toggleInventory());
    this.input.keyboard?.on("keydown-C", () => this.toggleCrafting());
    this.input.keyboard?.on("keydown-J", () => this.toggleJournal());

    // First visit hint
    const store2 = getStore(this);
    if (!store2.flags.firstTimeVisited["world" as never]) {
      (store2.flags.firstTimeVisited as Record<string, boolean>)["world"] = true;
      store2.pushLog("💡 화살표 키 또는 D-패드로 이동, 근처 오브젝트를 탭(클릭)하면 상호작용.");
      store2.pushLog("🚢 근처에 좌초된 배가 있다! 가까이 다가가 탭하면 내부를 수색할 수 있다.");
      // shipwreck 위치 힌트
      const ship = store2.map.entities.find((e) => e.type === "shipwreck");
      if (ship) {
        const dx = ship.tx - store2.playerTx;
        const dy = ship.ty - store2.playerTy;
        const dir = Math.abs(dx) >= Math.abs(dy)
          ? (dx > 0 ? "동쪽" : "서쪽")
          : (dy > 0 ? "남쪽" : "북쪽");
        store2.pushLog(`   → 배는 현재 위치에서 ${dir} 방향에 있다.`);
      }
    }
  }

  // ── Terrain rendering ──────────────────────────────────────────
  private renderTerrain(): void {
    const store = getStore(this);
    const map = store.map;
    const gfx = this.terrainGfx;
    gfx.clear();

    for (let ty = 0; ty < map.size; ty++) {
      for (let tx = 0; tx < map.size; tx++) {
        const terrType = map.terrain[ty][tx];
        const def = TERRAIN[terrType];
        // Slight checkerboard mottle
        const useMottle = def.mottle && (tx + ty) % 2 === 0;
        const col = useMottle ? def.mottle! : def.color;
        gfx.fillStyle(col, 1);
        gfx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
      }
    }
  }

  // ── Entity rendering ───────────────────────────────────────────
  private renderEntities(): void {
    const store = getStore(this);

    // Remove all existing entity sprites
    this.entityObjects.forEach((t) => t.destroy());
    this.entityObjects.clear();

    // Remove old entity objects from worldObjects tracking
    this.worldObjects = this.worldObjects.filter(
      (o) => o === this.terrainGfx || o === this.playerSprite || o === this.playerShadow
    );

    for (const entity of store.map.entities) {
      const def = ENTITIES[entity.type];
      const worldX = entity.tx * TILE_PX + TILE_PX / 2;
      const worldY = entity.ty * TILE_PX + TILE_PX / 2;

      const t = this.add
        .text(worldX, worldY, def.icon, { fontSize: "24px" })
        .setOrigin(0.5)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });

      t.on("pointerdown", () => this.tapEntity(entity));
      t.on("pointerover", () => {
        this.actionHintText.setText(`${def.icon} ${def.label} — 탭하여 상호작용`);
        this.tweens.add({ targets: t, scale: 1.2, duration: 120, ease: "Sine.Out" });
      });
      t.on("pointerout", () => {
        this.updateActionHint();
        this.tweens.add({ targets: t, scale: 1.0, duration: 120, ease: "Sine.Out" });
      });

      // 살아있는 엔티티는 가볍게 흔들/호흡 애니메이션
      if (entity.type === "rabbit") {
        this.tweens.add({
          targets: t,
          y: worldY - 3,
          duration: 320,
          ease: "Sine.InOut",
          yoyo: true,
          repeat: -1,
        });
      } else if (entity.type === "flower" || entity.type === "berry_bush" || entity.type === "mushroom" || entity.type === "vine") {
        this.tweens.add({
          targets: t,
          angle: 4,
          duration: 1200 + Math.random() * 800,
          ease: "Sine.InOut",
          yoyo: true,
          repeat: -1,
        });
      } else if (entity.type === "shell" || entity.type === "driftwood") {
        this.tweens.add({
          targets: t,
          y: worldY - 2,
          duration: 900 + Math.random() * 600,
          ease: "Sine.InOut",
          yoyo: true,
          repeat: -1,
        });
      }

      this.entityObjects.set(entity.id, t);
      this.worldObjects.push(t);
    }

    // Update UI camera ignore list
    this.uiCam.ignore(this.worldObjects);
  }

  /** 플레이어 머리 위로 획득 아이템 텍스트가 떠오르며 사라지는 이펙트. */
  private spawnPickupFx(tx: number, ty: number, text: string, color = "#ffd97a"): void {
    const wx = tx * TILE_PX + TILE_PX / 2;
    const wy = ty * TILE_PX + TILE_PX / 2;
    const fx = this.add
      .text(wx, wy - 10, text, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "14px",
        color,
        stroke: "#0a0f22",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.worldObjects.push(fx);
    this.uiCam.ignore(fx);
    this.tweens.add({
      targets: fx,
      y: wy - 48,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => fx.destroy(),
    });
  }

  // ── Player movement ────────────────────────────────────────────
  private tryMove(dx: number, dy: number): void {
    const store = getStore(this);
    const nx = store.playerTx + dx;
    const ny = store.playerTy + dy;

    if (!store.map.isPassable(nx, ny)) {
      // Check if there's a non-blocking entity we can interact with
      const entity = store.map.entityAt(nx, ny);
      if (entity) {
        this.tapEntity(entity);
      }
      return;
    }

    store.playerTx = nx;
    store.playerTy = ny;
    store.time.advanceMinutes(3);
    store.stats.apply({ energy: -0.5 });

    // Animate player
    const newX = nx * TILE_PX + TILE_PX / 2;
    const newY = ny * TILE_PX + TILE_PX / 2;
    this.tweens.add({
      targets: this.playerSprite,
      x: newX,
      y: newY,
      duration: 120,
      ease: "Linear",
    });
    this.tweens.add({
      targets: this.playerShadow,
      x: newX,
      y: newY + 10,
      duration: 120,
      ease: "Linear",
    });
    // 발자국 같은 잔상: 살짝 위아래로 튀어오르는 hop
    this.tweens.add({
      targets: this.playerSprite,
      scaleY: 0.92,
      duration: 60,
      yoyo: true,
      ease: "Quad.Out",
    });

    this.updateActionHint();

    // Night mob encounter chance
    if (store.time.phase === "night" && Math.random() < 0.04) {
      const mob = Phaser.Utils.Array.GetRandom(NIGHT_MOBS) as EnemyDef;
      this.triggerCombat(mob);
    }
  }

  // ── Entity interaction ─────────────────────────────────────────
  private tapEntity(entity: WorldEntity): void {
    const store = getStore(this);
    const reachable = store.map.reachableEntity(store.playerTx, store.playerTy, entity.tx, entity.ty);
    if (!reachable) {
      // Try to walk adjacent first
      store.pushLog(`${ENTITIES[entity.type].icon} ${ENTITIES[entity.type].label}에 접근해야 한다.`);
      this.updateActionHint();
      return;
    }

    switch (entity.type) {
      case "tree": {
        const count = Phaser.Math.Between(2, 3);
        store.inv.add("stick", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(15);
        store.stats.apply({ energy: -3 });
        store.pushLog(`🌳 나무에서 나뭇가지를 구했다. 나뭇가지 ×${count}`);
        this.spawnPickupFx(entity.tx, entity.ty, `+🪵×${count}`);
        audio.play("pickup");
        break;
      }

      case "berry_bush": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("berry", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        store.pushLog(`🫐 열매덤불에서 열매를 땄다. 열매 ×${count}`);
        this.spawnPickupFx(entity.tx, entity.ty, `+🫐×${count}`);
        audio.play("pickup");
        break;
      }

      case "stone_outcrop": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("stone", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(20);
        store.stats.apply({ energy: -5 });
        store.pushLog(`🪨 돌을 캤다. 돌 ×${count}`);
        this.spawnPickupFx(entity.tx, entity.ty, `+🪨×${count}`);
        audio.play("pickup");
        break;
      }

      case "vine": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("vine", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        store.pushLog(`🌿 덩굴을 모았다. 덩굴 ×${count}`);
        this.spawnPickupFx(entity.tx, entity.ty, `+🌿×${count}`);
        audio.play("pickup");
        break;
      }

      case "shell": {
        const r = Math.random();
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        if (r < 0.25) {
          store.inv.add("fish_raw", 1);
          store.pushLog("🐚 조개에서 날것 물고기를 찾았다.");
          this.spawnPickupFx(entity.tx, entity.ty, "+🐟×1");
        } else if (r < 0.45) {
          store.inv.add("stone", 1);
          store.pushLog("🐚 조개 속에 돌이 들어있었다.");
          this.spawnPickupFx(entity.tx, entity.ty, "+🪨×1");
        } else if (r < 0.65) {
          store.inv.add("cloth", 1);
          store.pushLog("🐚 조개에서 낡은 천 조각을 발견했다.");
          this.spawnPickupFx(entity.tx, entity.ty, "+🧵×1");
        } else if (r < 0.8) {
          store.inv.add("coconut", 1);
          store.pushLog("🥥 파도에 휩쓸려온 야자 열매를 주웠다.");
          this.spawnPickupFx(entity.tx, entity.ty, "+🥥×1", "#e3f0b0");
        } else {
          store.pushLog("🐚 빈 조개껍데기다.");
        }
        audio.play("pickup");
        break;
      }

      case "driftwood": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("stick", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        let msg = `🪵 유목에서 나뭇가지를 모았다. 나뭇가지 ×${count}`;
        this.spawnPickupFx(entity.tx, entity.ty, `+🪵×${count}`);
        if (Math.random() < 0.2) {
          store.inv.add("coconut", 1);
          msg += " (+🥥 야자 열매)";
          this.spawnPickupFx(entity.tx, entity.ty - 1, "+🥥×1", "#e3f0b0");
        }
        store.pushLog(msg);
        audio.play("pickup");
        break;
      }

      case "mushroom": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("mushroom", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        store.pushLog(`🍄 버섯을 채취했다. 버섯 ×${count} (약한 회복 효과)`);
        this.spawnPickupFx(entity.tx, entity.ty, `+🍄×${count}`, "#ffb3d1");
        audio.play("pickup");
        break;
      }

      case "rabbit": {
        store.time.advanceMinutes(40);
        store.stats.apply({ energy: -10 });
        const target = DAY_GAME[0] as EnemyDef;
        store.pushLog(`🐇 토끼를 발견했다!`);
        this.triggerCombat(target);
        return; // skip renderEntities below (combat will resume)
      }

      case "flower": {
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(5);
        store.pushLog("🌼 들꽃이 피어있다. 향기가 은은하다.");
        if (Math.random() < 0.1) {
          store.inv.add("cloth", 1);
          store.pushLog("  → 꽃잎으로 천 조각을 만들었다.");
          audio.play("pickup");
        }
        break;
      }

      case "cave_entrance": {
        if (store.inv.bestPickaxeTier() < 1) {
          store.pushLog("⛏ 동굴 입구다. 안으로 들어가려면 곡괭이(⛏)가 필요하다.\n   제작 패널(C키)에서 돌 곡괭이를 만들어보자: 나뭇가지×2 + 돌×3 + 덩굴×1");
          break;
        }
        store.pushLog("⛏ 동굴 안으로 들어간다... 어두운 돌 벽을 곡괭이로 두드리면 광석을 캘 수 있다.");
        store.caveDepth = 1;
        store.time.advanceMinutes(10);
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(420, () => {
          this.scene.launch("CaveScene");
          this.scene.pause();
        });
        return;
      }

      case "shipwreck": {
        const lootLeft = entity.meta?.lootLeft ?? 0;
        if (lootLeft > 0) {
          this.lootShipwreck(entity);
        } else {
          // 물자를 모두 수색한 뒤에는 배 안에서 잠들 수 있다
          this.sleepAt("shipwreck");
        }
        break;
      }

      case "cliff_lookout": {
        store.time.advanceMinutes(20);
        const nextBoss = Math.ceil(store.time.day / 10) * 10;
        const left = nextBoss - store.time.day;
        if (left === 0) {
          store.pushLog("🏔 수면이 부자연스럽게 솟구친다… 오늘 무언가 올 것이다.");
        } else if (left <= 2) {
          store.pushLog(`🏔 수평선이 검게 물든다. ${left}일 내에 해양 습격이 있을 것.`);
        } else {
          store.pushLog("🏔 수평선을 바라봤다. 구조선은 아직 없다.");
        }
        break;
      }

      case "river_spring": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("water_dirty", count);
        store.time.advanceMinutes(10);
        store.pushLog(`💧 샘물을 길었다. 더러운 물 ×${count} (끓여야 마실 수 있다)`);
        audio.play("pickup");
        break;
      }

      case "camp_spot": {
        if (store.flags.hasTent) {
          this.sleepAt("tent");
        } else if (store.inv.has("tent")) {
          // 인벤토리에 천막이 있으면 자동 설치
          store.inv.remove("tent", 1);
          store.flags.hasTent = true;
          store.pushLog("⛺ 거점에 천막을 설치했다! 이곳에서 편히 잠들 수 있다.");
          audio.play("craft");
          if (store.inv.has("bonfire")) {
            store.inv.remove("bonfire", 1);
            store.flags.hasBonfire = true;
            store.pushLog("🔥 모닥불도 함께 설치했다! 이제 요리가 가능하다.");
          }
        } else {
          store.pushLog(
            "🏕 거점 자리를 발견했다! 천막(⛺)을 제작해서 여기에 설치하면 매일 밤 쉴 수 있다.\n" +
            "   제작 패널(C키) → 천막: 천 조각×4 + 나뭇가지×6 + 밧줄×2"
          );
        }
        break;
      }
    }

    this.renderEntities();
    this.updateActionHint();
  }

  private lootShipwreck(entity: WorldEntity): void {
    const store = getStore(this);
    const lootLeft = entity.meta?.lootLeft ?? 0;

    store.time.advanceMinutes(30);
    store.stats.apply({ energy: -5 });

    const lootPools = [
      [
        { id: "can_food" as const, count: 3 },
        { id: "bandage" as const, count: 2 },
        { id: "water_clean" as const, count: 2 },
      ],
      [
        { id: "can_food" as const, count: 2 },
        { id: "pistol" as const, count: 1 },
        { id: "bullet" as const, count: 6 },
        { id: "medkit" as const, count: 1 },
      ],
      [
        { id: "blanket" as const, count: 1 },
        { id: "cloth" as const, count: 3 },
        { id: "water_clean" as const, count: 1 },
        { id: "large_bandage" as const, count: 1 },
      ],
    ];

    const idx = 3 - lootLeft; // lootLeft 3→pool 0, 2→pool 1, 1→pool 2
    const loot = lootPools[idx] ?? lootPools[0];
    for (const l of loot) store.inv.add(l.id, l.count);

    if (entity.meta) {
      entity.meta.lootLeft = lootLeft - 1;
    }

    const text = loot.map((l) => `${ITEMS[l.id].icon}${ITEMS[l.id].name}×${l.count}`).join(", ");
    store.pushLog(`📦 난파선 내부 수색: ${text}`);
    if ((entity.meta?.lootLeft ?? 0) <= 0) {
      store.pushLog("💭 배 안에 물자가 모두 떨어졌다. 이제 배 안에서 잠들 수 있다. (다시 탭)");
    }
    audio.play("pickup");
  }

  /** 쉼터 종류에 따라 다음 아침까지 시간을 건너뛰고 체력·행동력을 회복한다. */
  private sleepAt(where: "tent" | "shipwreck"): void {
    const store = getStore(this);

    // 낮이면 먼저 낮 구간을 건너뜀
    if (store.time.phase === "day") {
      const dayLeft = Math.floor((1 - store.time.phaseProgress) * 12 * 60);
      if (dayLeft > 0) store.time.advanceMinutes(dayLeft + 1);
    }
    // 밤 구간을 건너뜀 (아침까지)
    const nightLeft = Math.floor((1 - store.time.phaseProgress) * 12 * 60);
    if (nightLeft > 0) store.time.advanceMinutes(nightLeft + 1);

    // 행동력 완전 회복
    const energyNeeded = 100 - store.stats.energy;
    if (energyNeeded > 0) store.stats.apply({ energy: energyNeeded });

    if (where === "tent") {
      store.stats.apply({ hp: 40 });
      store.pushLog("⛺ 천막에서 편히 잠들었다. 체력과 행동력이 완전히 회복됐다!");
    } else {
      store.stats.apply({ hp: 20 });
      store.pushLog("🚢 배 안에서 잠들었다. 체력과 행동력이 어느정도 회복됐다.");
    }
    audio.play("heal");
  }

  // ── UI ─────────────────────────────────────────────────────────
  private buildDpad(): void {
    this.dpad.removeAll(true);
    const cx = GAME_WIDTH - 120;
    const cy = 688; // center of dpad in bottom UI
    const btnSize = 52;
    const gap = 4;

    const dirs: Array<[string, number, number]> = [
      ["↑", 0, -1],
      ["↓", 0, 1],
      ["←", -1, 0],
      ["→", 1, 0],
    ];
    const offsets: Record<string, [number, number]> = {
      "↑": [0, -(btnSize + gap)],
      "↓": [0, btnSize + gap],
      "←": [-(btnSize + gap), 0],
      "→": [btnSize + gap, 0],
    };

    for (const [label, dx, dy] of dirs) {
      const [ox, oy] = offsets[label];
      const btn = makeButton(this, cx + ox, cy + oy, {
        label,
        width: btnSize,
        height: btnSize,
        fontSize: 22,
        onClick: () => this.tryMove(dx, dy),
      });
      this.dpad.add(btn);
    }
  }

  private buildMenuBar(): void {
    this.menuBar.removeAll(true);
    const y = GAME_HEIGHT - 28;
    const buttons: Array<[string, () => void]> = [
      ["🎒 인벤토리", () => this.toggleInventory()],
      ["🔨 제작", () => this.toggleCrafting()],
      ["📖 일지", () => this.toggleJournal()],
      ["💾 저장", () => this.manualSave()],
      ["🏠 타이틀", () => this.backToTitle()],
    ];
    const bw = 160;
    const gap = 8;
    const total = buttons.length * bw + (buttons.length - 1) * gap;
    const startX = (GAME_WIDTH - total) / 2 + bw / 2;
    buttons.forEach(([label, cb], i) => {
      const b = makeButton(this, startX + i * (bw + gap), y, {
        label,
        width: bw,
        height: 36,
        fontSize: 12,
        onClick: cb,
      });
      this.menuBar.add(b);
    });
  }

  private updateActionHint(): void {
    const store = getStore(this);
    const { playerTx, playerTy } = store;
    // Check adjacent entities
    const adjacent: WorldEntity[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const e = store.map.entityAt(playerTx + dx, playerTy + dy);
        if (e) adjacent.push(e);
      }
    }
    // Also same tile
    const same = store.map.entityAt(playerTx, playerTy);
    if (same) adjacent.unshift(same);

    if (adjacent.length > 0) {
      const names = adjacent
        .slice(0, 3)
        .map((e) => `${ENTITIES[e.type].icon}${ENTITIES[e.type].label}`)
        .join(", ");
      this.actionHintText.setText(`근처: ${names}\n(탭하여 상호작용 | I:인벤토리 C:제작 J:일지)`);
    } else {
      this.actionHintText.setText("화살표 키 또는 D-패드로 이동 | I:인벤토리 C:제작 J:일지");
    }
  }

  // ── Combat triggers ────────────────────────────────────────────
  private triggerSeaBoss(day: number): void {
    const idx = Math.min(SEA_BOSSES.length - 1, Math.floor(day / 10) - 1);
    const boss = SEA_BOSSES[idx];
    getStore(this).pushLog(`⚠ ${boss.name}이(가) 해안에 나타났다!`);
    audio.play("boss_alert");
    this.triggerCombat(boss);
  }

  private triggerCombat(enemy: EnemyDef): void {
    this.scene.launch("CombatScene", { enemy });
    this.scene.pause();
  }

  private syncBgm(): void {
    const store = getStore(this);
    audio.playBgm(store.time.phase === "day" ? "day" : "night");
  }

  // ── Panel toggles ──────────────────────────────────────────────
  private toggleInventory(): void {
    audio.play("menu");
    if (this.inventoryPanel.isOpen) this.inventoryPanel.close();
    else this.inventoryPanel.open(() => this.updateActionHint());
  }

  private toggleCrafting(): void {
    audio.play("menu");
    if (this.craftingPanel.isOpen) this.craftingPanel.close();
    else this.craftingPanel.open();
  }

  private toggleJournal(): void {
    audio.play("menu");
    if (this.journalPanel.isOpen) this.journalPanel.close();
    else this.journalPanel.open();
  }

  private manualSave(): void {
    const store = getStore(this);
    store.save();
    store.pushLog("💾 게임을 저장했다.");
  }

  private backToTitle(): void {
    this.scene.stop("HUDScene");
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => this.scene.start("TitleScene"));
  }

  resumeFromOverlay(): void {
    this.renderEntities();
    this.updateActionHint();
    this.syncBgm();
  }
}
