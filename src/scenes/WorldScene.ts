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
    if (!store2.flags.firstTimeVisited["beach" as never]) {
      store2.pushLog("파도에 떠밀려 해변에 도착했다. D-패드나 화살표 키로 이동하고, 주변 자원을 탭하자.");
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
    this.worldObjects = this.worldObjects.filter((o) => o === this.terrainGfx || o === this.playerSprite);

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
      });
      t.on("pointerout", () => this.updateActionHint());

      this.entityObjects.set(entity.id, t);
      this.worldObjects.push(t);
    }

    // Update UI camera ignore list
    this.uiCam.ignore(this.worldObjects);
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
    this.tweens.add({
      targets: this.playerSprite,
      x: nx * TILE_PX + TILE_PX / 2,
      y: ny * TILE_PX + TILE_PX / 2,
      duration: 120,
      ease: "Linear",
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
        audio.play("pickup");
        break;
      }

      case "berry_bush": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("berry", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        store.pushLog(`🫐 열매덤불에서 열매를 땄다. 열매 ×${count}`);
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
        audio.play("pickup");
        break;
      }

      case "vine": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("vine", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        store.pushLog(`🌿 덩굴을 모았다. 덩굴 ×${count}`);
        audio.play("pickup");
        break;
      }

      case "shell": {
        const r = Math.random();
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        if (r < 0.3) {
          store.inv.add("fish_raw", 1);
          store.pushLog("🐚 조개에서 날것 물고기를 찾았다.");
        } else if (r < 0.6) {
          store.inv.add("stone", 1);
          store.pushLog("🐚 조개 속에 돌이 들어있었다.");
        } else if (r < 0.8) {
          store.inv.add("cloth", 1);
          store.pushLog("🐚 조개에서 낡은 천 조각을 발견했다.");
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
        store.pushLog(`🪵 유목에서 나뭇가지를 모았다. 나뭇가지 ×${count}`);
        audio.play("pickup");
        break;
      }

      case "mushroom": {
        store.inv.add("berry", 1); // mushroom as food item
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        store.pushLog("🍄 버섯을 채취했다. (먹을 수 있다)");
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
        store.pushLog("🕳 동굴로 들어간다...");
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
        this.lootShipwreck(entity);
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
          this.sleep();
        } else {
          store.pushLog("🏕 거점을 찾았다. 천막을 세워야 안전하게 쉴 수 있다.");
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
    if (lootLeft <= 0) {
      store.pushLog("🚢 난파선을 뒤졌지만 아무것도 남아있지 않다.");
      return;
    }

    store.time.advanceMinutes(30);
    store.stats.apply({ energy: -5 });

    const lootPools = [
      [
        { id: "can_food" as const, count: 3 },
        { id: "bandage" as const, count: 1 },
        { id: "water_clean" as const, count: 2 },
      ],
      [
        { id: "can_food" as const, count: 2 },
        { id: "pistol" as const, count: 1 },
        { id: "bullet" as const, count: 6 },
      ],
      [
        { id: "blanket" as const, count: 1 },
        { id: "cloth" as const, count: 3 },
        { id: "water_clean" as const, count: 1 },
      ],
    ];

    const idx = 3 - lootLeft; // lootLeft 3→pool 0, 2→pool 1, 1→pool 2
    const loot = lootPools[idx] ?? lootPools[0];
    for (const l of loot) store.inv.add(l.id, l.count);

    if (entity.meta) {
      entity.meta.lootLeft = lootLeft - 1;
    }

    const text = loot.map((l) => `${ITEMS[l.id].icon}${ITEMS[l.id].name}×${l.count}`).join(", ");
    store.pushLog(`📦 난파선에서 ${text}을(를) 찾았다.`);
    audio.play("pickup");
  }

  private sleep(): void {
    const store = getStore(this);
    const quality = store.flags.hasTent ? "편안하게" : "땅바닥에서";
    if (store.time.phase === "day") {
      store.time.advanceMinutes(12 * 60 - Math.floor(store.time.phaseProgress * 12 * 60));
    }
    store.time.advanceMinutes(12 * 60 - Math.floor(store.time.phaseProgress * 12 * 60));
    store.stats.restFull();
    if (store.flags.hasTent) store.stats.apply({ hp: 20 });
    store.pushLog(`💤 ${quality} 하룻밤을 보냈다.`);
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
