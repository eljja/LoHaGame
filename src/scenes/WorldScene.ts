import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, WIN_DAY, COLORS } from "../config";
import { TERRAIN, ENTITIES, TILE_PX, WORLD_PX } from "../data/tiles";
import { ITEMS } from "../data/items";
import { RECIPES } from "../data/recipes";
import { SEA_BOSSES, NIGHT_MOBS, DAY_GAME, MINI_BOSSES } from "../data/enemies";
import type { EnemyDef, ItemId } from "../types";
import { getStore } from "../systems/GameStore";
import type { WorldEntity } from "../systems/WorldMap";
import { makeButton, type ButtonNode } from "../ui/Button";
import { InventoryPanel } from "../ui/InventoryPanel";
import { CraftingPanel } from "../ui/CraftingPanel";
import { JournalPanel } from "../ui/JournalPanel";
import { BottleTradePanel } from "../ui/BottleTradePanel";
import { audio } from "../systems/AudioManager";
import { showAchievementToast } from "../ui/AchievementToast";
import type { Achievement } from "../data/achievements";

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
  private equipBarText!: Phaser.GameObjects.Text;
  private menuBar!: Phaser.GameObjects.Container;
  private dpad!: Phaser.GameObjects.Container;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private lightsGfx!: Phaser.GameObjects.Graphics;

  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;
  private journalPanel!: JournalPanel;
  private bottleTradePanel!: BottleTradePanel;

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

    // HUDScene이 실행 중이 아니면 런치 (TitleScene/IntroScene에서 이미 런치했으면 무시됨)
    if (!this.scene.isActive("HUDScene")) {
      this.scene.launch("HUDScene");
    }

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

    // Action hint text — 버튼/D-pad 아래 하단 영역에 표시 (y=762)
    this.actionHintText = this.add.text(16, 762, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#9fb7ff",
      wordWrap: { width: GAME_WIDTH - 32 },
    });
    this.uiContainer.add(this.actionHintText);

    // 장비 상태 표시 — 힌트 아래 (y=782)
    this.equipBarText = this.add.text(16, 782, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#ffd97a",
      wordWrap: { width: GAME_WIDTH - 32 },
    });
    this.uiContainer.add(this.equipBarText);
    this.refreshEquipBar();

    // 밤 어둠 오버레이 (횃불 없으면 짙어짐, worldCam 무관 — uiCam으로 렌더)
    this.nightOverlay = this.add
      .rectangle(VP_X, VP_Y, VP_W, VP_H, 0x000020, 0)
      .setOrigin(0, 0)
      .setDepth(40);
    this.uiContainer.add(this.nightOverlay);

    // 설치된 모닥불/천막 주변을 밝히는 광원 레이어 (밤에만 표시).
    // 어둠 위에 ADD 블렌드로 노란색 원을 그려 국소적으로 밝기를 보탠다.
    this.lightsGfx = this.add.graphics().setDepth(41);
    this.lightsGfx.setBlendMode(Phaser.BlendModes.ADD);
    this.uiContainer.add(this.lightsGfx);

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
    this.bottleTradePanel = new BottleTradePanel(this);

    // ── UI Camera ignores world objects ───────────────────
    this.uiCam.ignore(this.worldObjects);
    // ── World Camera ignores UI objects (prevents duplicated buttons scrolling with map) ───
    this.worldCam.ignore(this.uiContainer);

    // ── Render world ──────────────────────────────────────
    this.renderTerrain();
    this.renderEntities();
    this.updateActionHint();

    // ── Event bindings ────────────────────────────────────
    // ── Achievement & recipe discovery listeners ──────────────────
    store.on("achievement", (ach: Achievement) => showAchievementToast(this, ach));
    store.on("recipesDiscovered", (ids: string[]) => {
      ids.forEach((id, i) => {
        const recipe = RECIPES.find((r) => r.id === id);
        if (!recipe) return;
        this.time.delayedCall(i * 700, () => {
          store.pushLog(`📜 새 레시피 발견: ${recipe.icon} ${recipe.name}!`);
        });
      });
    });

    store.time.on("phaseChange", (phase: "day" | "night") => {
      audio.play(phase === "day" ? "phase_day" : "phase_night");
      this.syncBgm();
      this.updateNightOverlay();
      if (phase === "day") {
        const count = store.map.nightRespawn();
        this.renderEntities();
        store.pushLog(`☀ 새벽이 밝아왔다. 자원 ${count}개가 재생됐다.`);
        this.time.delayedCall(800, () => audio.play("bird"));
        this.time.delayedCall(2200, () => audio.play("bird"));
      } else {
        const hasTorch = store.inv.count("torch") > 0;
        if (!hasTorch) {
          store.pushLog("🌙 밤이 됐다. 횃불(🔥)이 없어 어둡고 위험하다. 에너지 소모가 늘어난다.");
        } else {
          store.pushLog("🔥 횃불을 켰다. 밤에도 주변이 환하다.");
        }
      }
    });

    store.time.on("dayChange", (d: number) => {
      store.pushLog(`☀ Day ${d}가 밝았다.`);
      store.checkTimedAchievements();
      // 심은 씨앗 2일 뒤 수확 가능 단계로 성장
      this.matureGardenPlants();
      // 바다에 띄운 유리병 귀환 체크
      this.processBottleReturn();
      if (d > WIN_DAY) {
        this.scene.stop("HUDScene");
        this.scene.start("VictoryScene", { raftEscape: false, days: d });
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
      // cave depth achievement (check before CaveScene resets depth)
      if (store.caveDepth >= 3) store.unlockAchievement("cave_floor3");
      store.checkTimedAchievements();
    });

    // 동적 요소: 야생동물 방황, 날씨, 구름, 일일 무작위 이벤트
    this.setupWildlifeAI();
    this.setupClouds();
    this.setupWeather();
    this.setupRandomEvents();

    // 인벤토리 변경 시 장비바 갱신
    store.inv.on("change", () => {
      this.refreshEquipBar();
      this.updateNightOverlay();
    });

    // ── Keyboard ──────────────────────────────────────────
    this.input.keyboard?.on("keydown-UP", () => this.tryMove(0, -1));
    this.input.keyboard?.on("keydown-DOWN", () => this.tryMove(0, 1));
    this.input.keyboard?.on("keydown-LEFT", () => this.tryMove(-1, 0));
    this.input.keyboard?.on("keydown-RIGHT", () => this.tryMove(1, 0));
    this.input.keyboard?.on("keydown-I", () => this.toggleInventory());
    this.input.keyboard?.on("keydown-C", () => this.toggleCrafting());
    this.input.keyboard?.on("keydown-J", () => this.toggleJournal());
    this.input.keyboard?.on("keydown-Z", () => this.trySleep());
    this.input.keyboard?.on("keydown-NUMPAD_FIVE", () => this.pickupAtPlayer());
    this.input.keyboard?.on("keydown-ENTER", () => this.pickupAtPlayer());
    this.input.keyboard?.on("keydown-SPACE", () => this.pickupAtPlayer());

    // First visit hint
    const store2 = getStore(this);
    if (!store2.flags.firstTimeVisited["world" as never]) {
      (store2.flags.firstTimeVisited as Record<string, boolean>)["world"] = true;
      store2.pushLog("💡 화살표/D-패드로 이동. 가운데 ✋ 버튼·Numpad5·Enter·Space로 현재 위치 또는 인접 자원을 줍는다.");
      store2.pushLog("💤 쉴 곳: 🏕 거점 자리에 ⛺ 천막을 설치하거나, 🚢 난파선 수색을 마치면 근처에서 Z 키/잠자기 버튼으로 잘 수 있다.");
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

    // 엔티티 상태가 바뀌었을 수 있으므로 콤보 재계산 (변동 시 로그 발생)
    store.recomputeCombos();

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
      } else if (entity.type === "bonfire_placed") {
        // 불꽃이 살짝 크기·색으로 일렁임
        this.tweens.add({
          targets: t,
          scale: 1.12,
          duration: 380,
          ease: "Sine.InOut",
          yoyo: true,
          repeat: -1,
        });
      } else if (entity.type === "tent_placed") {
        this.tweens.add({
          targets: t,
          scaleY: 1.06,
          duration: 1800,
          ease: "Sine.InOut",
          yoyo: true,
          repeat: -1,
        });
      } else if (entity.type === "buried_treasure") {
        // 살짝 반짝이는 효과
        t.setAlpha(0.85);
        this.tweens.add({
          targets: t,
          alpha: 1,
          duration: 700,
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

  /** first_hunt 특성: 채집 시 10% 확률로 아이템 1개 추가 획득 */
  private gatherPerkBonus(tx: number, ty: number, itemId: ItemId): void {
    const store = getStore(this);
    if (store.perkGatherBonus > 0 && Math.random() < store.perkGatherBonus) {
      store.inv.add(itemId, 1);
      this.spawnPickupFx(tx, ty - 1, "✨+1", "#ffe58a");
    }
  }

  // ── Night sky events ───────────────────────────────────────────

  /** 밤하늘 관찰 — 하루에 한 번만 발동. 무작위 천문 이벤트 + 버프. */
  private rollNightSkyEvent(): void {
    const store = getStore(this);
    const dayKey = store.time.day * 2 + 1; // night unique key
    if (store.flags.lastNightSkyDay === dayKey) {
      store.pushLog("🌙 이미 오늘 밤 하늘을 관찰했다.");
      return;
    }
    store.flags.lastNightSkyDay = dayKey;

    const r = Math.random();
    if (r < 0.12) {
      store.stats.apply({ energy: 30 });
      store.pushLog("🌌 오로라가 밤하늘을 물들인다! 넋이 나간다. (행동력 +30)");
      this.showNightSkyEffect("aurora");
      store.unlockAchievement("stargazer");
    } else if (r < 0.40) {
      store.stats.apply({ energy: 20 });
      store.pushLog("🌠 밤하늘을 가로지르는 별똥별! 소원을 빌었다. (행동력 +20)");
      this.showNightSkyEffect("meteor");
      store.unlockAchievement("stargazer");
    } else if (r < 0.58) {
      store.flags.nightSkyBuff = true;
      store.pushLog("🌙 달무리가 피어났다. 포근하다. 지금 잠들면 HP 회복량이 증가한다.");
      this.showNightSkyEffect("moon");
      store.unlockAchievement("stargazer");
    } else if (r < 0.78) {
      store.stats.apply({ energy: 15 });
      store.pushLog("⭐ 별자리가 선명하다. 왠지 마음이 안정된다. (행동력 +15)");
      store.unlockAchievement("stargazer");
    } else {
      store.stats.apply({ energy: 8 });
      store.pushLog("🌙 고요한 밤이다. 파도 소리가 마음을 달랜다. (행동력 +8)");
    }
  }

  private showNightSkyEffect(type: "aurora" | "meteor" | "moon"): void {
    if (type === "aurora") {
      const rect1 = this.add.rectangle(VP_X, VP_Y, VP_W, VP_H, 0x00e070, 0).setOrigin(0, 0).setDepth(305);
      this.worldCam.ignore(rect1);
      this.tweens.add({
        targets: rect1,
        fillAlpha: 0.18,
        duration: 2500,
        yoyo: true,
        ease: "Sine.InOut",
        onComplete: () => rect1.destroy(),
      });
      this.time.delayedCall(500, () => {
        const rect2 = this.add.rectangle(VP_X, VP_Y, VP_W, VP_H, 0xff55ff, 0).setOrigin(0, 0).setDepth(304);
        this.worldCam.ignore(rect2);
        this.tweens.add({
          targets: rect2,
          fillAlpha: 0.10,
          duration: 3200,
          yoyo: true,
          ease: "Sine.InOut",
          onComplete: () => rect2.destroy(),
        });
      });
    } else if (type === "meteor") {
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(i * 260, () => {
          const sx = Phaser.Math.Between(VP_X + 60, VP_X + VP_W / 2);
          const sy = Phaser.Math.Between(VP_Y + 20, VP_Y + 100);
          const star = this.add.text(sx, sy, "✨", { fontSize: "16px" }).setDepth(310).setAlpha(1);
          this.worldCam.ignore(star);
          this.tweens.add({
            targets: star,
            x: sx + 200,
            y: sy + 90,
            alpha: 0,
            duration: 650,
            ease: "Quad.Out",
            onComplete: () => star.destroy(),
          });
        });
      }
    } else if (type === "moon") {
      const mx = VP_X + VP_W * 0.75;
      const my = VP_Y + 55;
      const ring = this.add.circle(mx, my, 56, 0xffeebb, 0).setDepth(305);
      const moon = this.add.text(mx, my, "🌕", { fontSize: "32px" }).setOrigin(0.5).setDepth(307).setAlpha(0);
      this.worldCam.ignore(ring);
      this.worldCam.ignore(moon);
      this.tweens.add({
        targets: ring,
        fillAlpha: 0.45,
        duration: 1600,
        hold: 2200,
        yoyo: true,
        ease: "Sine.InOut",
        onComplete: () => ring.destroy(),
      });
      this.tweens.add({
        targets: moon,
        alpha: 1,
        duration: 1600,
        hold: 2200,
        yoyo: true,
        ease: "Sine.InOut",
        onComplete: () => moon.destroy(),
      });
    }
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

    // 밤에 횃불 없으면 에너지 추가 소모
    if (store.time.phase === "night" && !store.inv.has("torch")) {
      store.stats.apply({ energy: -1.5 });
    }

    // Night mob encounter chance (횃불 없으면 더 위험)
    // 모닥불/천막 2칸 이내에서는 몹이 접근하지 않는다
    const nightEncounterChance = store.time.phase === "night" && !store.isInLightArea(nx, ny)
      ? (store.inv.has("torch") ? 0.0125 : 0.03)
      : 0;
    if (nightEncounterChance > 0 && Math.random() < nightEncounterChance) {
      // 미니보스 특수 조우 (day 5+부터, 야간 횃불 없을 때 확률↑)
      if (store.time.day >= 5 && Math.random() < 0.12) {
        const terrain = store.map.terrainAt(nx, ny);
        let mini: EnemyDef | null = null;
        if (terrain === "forest") mini = MINI_BOSSES.thorn_vine;
        else if (terrain === "sand") mini = MINI_BOSSES.abyss_scrap;
        if (mini) {
          store.pushLog(`⚠ 심상치 않은 기척... ${mini.name}이(가) 나타났다!`);
          audio.play("boss_alert");
          this.triggerCombat(mini);
          return;
        }
      }
      const mob = Phaser.Utils.Array.GetRandom(NIGHT_MOBS) as EnemyDef;
      this.triggerCombat(mob);
    }
  }

  /** 현재 플레이어 위치(같은 타일 우선) 또는 4방향 인접 타일의 엔티티에 상호작용한다. */
  private pickupAtPlayer(): void {
    const store = getStore(this);
    const tx = store.playerTx;
    const ty = store.playerTy;

    // 1) 같은 타일 (씨앗·수확·발자국 등)
    const here = store.map.entityAt(tx, ty);
    if (here) { this.tapEntity(here); return; }

    // 2) 4방향 인접 — 가까운 순서로 첫 번째 상호작용 가능한 엔티티
    const offsets: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of offsets) {
      const adj = store.map.entityAt(tx + dx, ty + dy);
      if (adj) {
        const reachable = store.map.reachableEntity(tx, ty, adj.tx, adj.ty);
        if (reachable) { this.tapEntity(adj); return; }
      }
    }

    store.pushLog("✋ 주변에 상호작용할 게 없다.");
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
        this.gatherPerkBonus(entity.tx, entity.ty, "stick");
        store.discoverRecipes("stick");
        audio.play("wood_chop");
        break;
      }

      case "berry_bush": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("berry", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(10);
        let msg = `🫐 열매덤불에서 열매를 땄다. 열매 ×${count}`;
        // 씨앗 드롭 (30%)
        if (Math.random() < 0.30) {
          store.inv.add("seed", 1);
          msg += ` (+🌱 씨앗×1)`;
          this.spawnPickupFx(entity.tx, entity.ty - 1, "+🌱×1", "#a8ee60");
          store.discoverRecipes("seed");
        }
        store.pushLog(msg);
        this.spawnPickupFx(entity.tx, entity.ty, `+🫐×${count}`);
        this.gatherPerkBonus(entity.tx, entity.ty, "berry");
        store.discoverRecipes("berry");
        audio.play("pickup");
        break;
      }

      case "stone_outcrop": {
        const baseCount = Phaser.Math.Between(1, 2);
        const forgeBonus = store.activeCombos.has("forge") ? baseCount : 0;
        const count = baseCount + forgeBonus;
        store.inv.add("stone", count);
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(20);
        store.stats.apply({ energy: -5 });
        const msg = forgeBonus > 0
          ? `🪨 돌을 캤다. 돌 ×${count} (🏭화로 보너스 +${forgeBonus})`
          : `🪨 돌을 캤다. 돌 ×${count}`;
        store.pushLog(msg);
        this.spawnPickupFx(entity.tx, entity.ty, `+🪨×${count}`);
        this.gatherPerkBonus(entity.tx, entity.ty, "stone");
        store.discoverRecipes("stone");
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
        this.gatherPerkBonus(entity.tx, entity.ty, "vine");
        store.discoverRecipes("vine");
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
          store.discoverRecipes("fish_raw");
        } else if (r < 0.45) {
          store.inv.add("stone", 1);
          store.pushLog("🐚 조개 속에 돌이 들어있었다.");
          this.spawnPickupFx(entity.tx, entity.ty, "+🪨×1");
          store.discoverRecipes("stone");
        } else if (r < 0.65) {
          store.inv.add("cloth", 1);
          store.pushLog("🐚 조개에서 낡은 천 조각을 발견했다.");
          this.spawnPickupFx(entity.tx, entity.ty, "+🧵×1");
          store.discoverRecipes("cloth");
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
        this.gatherPerkBonus(entity.tx, entity.ty, "mushroom");
        store.discoverRecipes("mushroom");
        audio.play("pickup");
        break;
      }

      case "rabbit": {
        store.time.advanceMinutes(40);
        store.stats.apply({ energy: -10 });
        const target = DAY_GAME[0] as EnemyDef;
        store.pushLog(`🐇 토끼를 발견했다!`);
        store.unlockAchievement("first_hunt");
        store.map.removeEntity(entity.id);
        this.renderEntities();
        this.triggerCombat(target);
        return;
      }

      case "wolf": {
        store.time.advanceMinutes(30);
        store.stats.apply({ energy: -12 });
        const wolfDef = DAY_GAME.find((d) => d.id === "wolf")!;
        store.pushLog("🐺 굶주린 늑대가 달려든다! 공격력이 높으니 조심하라.");
        audio.play("boss_alert");
        store.map.removeEntity(entity.id);
        this.renderEntities();
        this.triggerCombat(wolfDef);
        return;
      }

      case "boar": {
        store.time.advanceMinutes(35);
        store.stats.apply({ energy: -14 });
        const boarDef = DAY_GAME.find((d) => d.id === "boar")!;
        store.pushLog("🐗 성난 멧돼지가 엄니를 들이댄다! 도망은 불가능하다.");
        audio.play("boss_alert");
        store.map.removeEntity(entity.id);
        this.renderEntities();
        this.triggerCombat(boarDef);
        return;
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
        if (store.time.phase === "night") {
          store.pushLog("🏔 어두운 밤바다 위로 별이 쏟아진다...");
          this.rollNightSkyEvent();
        } else {
          const nextBoss = Math.ceil(store.time.day / 10) * 10;
          const left = nextBoss - store.time.day;
          if (left === 0) {
            store.pushLog("🏔 수면이 부자연스럽게 솟구친다… 오늘 무언가 올 것이다.");
          } else if (left <= 2) {
            store.pushLog(`🏔 수평선이 검게 물든다. ${left}일 내에 해양 습격이 있을 것.`);
          } else {
            store.pushLog("🏔 수평선을 바라봤다. 구조선은 아직 없다.");
          }
        }
        break;
      }

      case "river_spring": {
        const count = Phaser.Math.Between(1, 2);
        store.inv.add("water_dirty", count);
        store.time.advanceMinutes(10);
        store.pushLog(`💧 샘물을 길었다. 더러운 물 ×${count} (끓여야 마실 수 있다)`);
        store.discoverRecipes("water_dirty");
        // 낚싯대 있으면 낚시 포인트 힌트
        if (store.inv.hasTool("rod")) {
          store.pushLog("💡 근처에 낚시 포인트(🎣)가 있다면 탭해서 낚시할 수 있다.");
        }
        audio.play("water_splash");
        break;
      }

      case "fishing_spot": {
        if (!store.inv.hasTool("rod")) {
          store.pushLog("🎣 낚시 포인트다. 낚싯대(🎣)가 있어야 낚시할 수 있다.\n   제작: 나뭇가지×3 + 덩굴×2");
        } else {
          this.startFishing(entity.tx, entity.ty);
          return;
        }
        break;
      }

      case "camp_spot": {
        // 이 타일에 바로 천막을 설치 (플레이어가 camp_spot과 같은 칸에 서 있을 때)
        const onCamp = store.playerTx === entity.tx && store.playerTy === entity.ty;
        if (onCamp && store.inv.has("tent")) {
          store.map.removeEntity(entity.id);
          let maxId = 0;
          for (const e of store.map.entities) if (e.id > maxId) maxId = e.id;
          store.map.entities.push({ id: maxId + 1, type: "tent_placed", tx: entity.tx, ty: entity.ty });
          store.inv.remove("tent", 1);
          store.flags.hasTent = true;
          store.pushLog("⛺ 거점 자리에 천막을 설치했다! 이 자리에서 잘 수 있고, 주변 2칸 이내는 밤에도 밝고 안전하다.");
          if (store.inv.has("bonfire")) {
            // 천막 옆 빈 칸에 모닥불을 함께 설치
            const neighbors: Array<[number, number]> = [
              [entity.tx + 1, entity.ty], [entity.tx - 1, entity.ty],
              [entity.tx, entity.ty + 1], [entity.tx, entity.ty - 1],
            ];
            for (const [nx, ny] of neighbors) {
              if (!store.map.in(nx, ny)) continue;
              const t = store.map.terrain[ny][nx];
              if (t !== "grass" && t !== "sand" && t !== "forest") continue;
              if (store.map.entityAt(nx, ny)) continue;
              let mid = 0;
              for (const e of store.map.entities) if (e.id > mid) mid = e.id;
              store.map.entities.push({ id: mid + 1, type: "bonfire_placed", tx: nx, ty: ny });
              store.inv.remove("bonfire", 1);
              store.flags.hasBonfire = true;
              store.pushLog("🔥 천막 옆에 모닥불도 피웠다! 이제 요리가 가능하다.");
              break;
            }
          }
          audio.play("craft");
        } else if (!onCamp) {
          store.pushLog("🏕 거점 자리다. 이 타일 위로 이동해 천막(⛺)을 설치하자.");
        } else {
          store.pushLog(
            "🏕 거점 자리를 발견했다! 천막(⛺)을 제작해서 여기에 설치하면 매일 밤 쉴 수 있다.\n" +
            "   제작 패널(C키) → 천막: 천 조각×4 + 나뭇가지×6 + 밧줄×2"
          );
        }
        break;
      }

      case "tent_placed": {
        if (store.time.phase === "night") this.rollNightSkyEvent();
        this.sleepAt("tent");
        break;
      }

      case "bonfire_placed": {
        store.pushLog("🔥 모닥불이 은은한 열기를 내뿜는다. 주변 2칸 이내에서 요리할 수 있다.");
        break;
      }

      case "planted_seed": {
        const plantedDay = entity.meta?.plantedDay ?? store.time.day;
        const elapsed = store.time.day - plantedDay;
        store.pushLog(`🌱 심은 씨앗이다. (${elapsed}/2일 경과)`);
        break;
      }

      case "ripe_plant": {
        store.map.removeEntity(entity.id);
        store.time.advanceMinutes(5);
        const berryCount = Phaser.Math.Between(2, 4);
        const seedCount = Math.random() < 0.6 ? 1 : 0;
        store.inv.add("berry", berryCount);
        if (seedCount > 0) store.inv.add("seed", seedCount);
        store.pushLog(`🌿 텃밭에서 열매를 수확했다! 열매 ×${berryCount}${seedCount > 0 ? `, 씨앗 ×${seedCount}` : ""}`);
        this.spawnPickupFx(entity.tx, entity.ty, `+🫐×${berryCount}`);
        store.discoverRecipes("berry");
        audio.play("pickup");
        break;
      }

      case "signal_fire_unlit": {
        if (!store.inv.has("torch")) {
          store.pushLog("🗼 봉화대에 불을 붙이려면 횃불(🔥)이 필요하다.");
          break;
        }
        store.inv.remove("torch", 1);
        // 같은 위치에 lit 엔티티로 교체
        const tx = entity.tx;
        const ty = entity.ty;
        store.map.removeEntity(entity.id);
        let maxId = 0;
        for (const e of store.map.entities) if (e.id > maxId) maxId = e.id;
        store.map.entities.push({ id: maxId + 1, type: "signal_fire_lit", tx, ty });
        store.pushLog("🔥 봉화대에 불을 붙였다! 해양 보스의 힘이 약해진다.");
        audio.play("craft");
        this.spawnPickupFx(tx, ty, "🔥🔥🔥", "#ffcc44");
        break;
      }

      case "signal_fire_lit": {
        const lit = store.map.entities.filter((e) => e.type === "signal_fire_lit").length;
        store.pushLog(`🔥 타오르는 봉화대. 점화된 봉화 ${lit}개 — 다음 해양 보스 공격력 ${Math.min(60, lit * 30)}% 감소.`);
        break;
      }

      case "raft_placed": {
        this.tryRaftEscape(entity);
        return;
      }

      case "buried_treasure": {
        if (store.inv.bestPickaxeTier() < 1) {
          store.pushLog("❌ 땅이 수상하게 부풀어있다. 곡괭이(⛏)가 있어야 파낼 수 있다.");
          break;
        }
        store.time.advanceMinutes(30);
        store.stats.apply({ energy: -12 });
        store.map.removeEntity(entity.id);

        const roll = Math.random();
        const drops: Array<{ id: import("../types").ItemId; count: number }> = [];
        if (roll < 0.25) {
          drops.push({ id: "medkit", count: 1 });
          drops.push({ id: "can_food", count: 4 });
          drops.push({ id: "water_clean", count: 2 });
        } else if (roll < 0.5) {
          drops.push({ id: "pistol", count: 1 });
          drops.push({ id: "bullet", count: 10 });
          drops.push({ id: "large_bandage", count: 2 });
        } else if (roll < 0.8) {
          drops.push({ id: "diamond", count: 2 });
          drops.push({ id: "iron_ore", count: 5 });
          drops.push({ id: "metal_scrap", count: 4 });
        } else {
          drops.push({ id: "iron_sword", count: 1 });
          drops.push({ id: "treasure_map", count: 1 });
          drops.push({ id: "energy_tonic", count: 1 });
        }

        for (const d of drops) store.inv.add(d.id, d.count);
        const text = drops.map((d) => `${ITEMS[d.id].icon}${ITEMS[d.id].name}×${d.count}`).join(", ");
        store.pushLog(`💰 묻혀있던 보물을 발견했다! ${text}`);
        store.unlockAchievement("treasure_dug");
        audio.play("victory");
        this.spawnPickupFx(entity.tx, entity.ty, "💰💰💰", "#ffd700");
        // 황금빛 파티클 몇 개
        for (let i = 0; i < 6; i++) {
          this.time.delayedCall(i * 80, () =>
            this.spawnPickupFx(entity.tx, entity.ty, "✨", "#ffe58a")
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
        { id: "treasure_map" as const, count: 1 },
      ],
    ];

    const idx = 3 - lootLeft; // lootLeft 3→pool 0, 2→pool 1, 1→pool 2
    const loot = lootPools[idx] ?? lootPools[0];
    for (const l of loot) {
      store.inv.add(l.id, l.count);
      store.discoverRecipes(l.id);
    }

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

    // 다음 아침(phase=day 시작)까지 시간을 건너뜀. while로 처리해 edge case 방지.
    let safety = 0;
    while (safety++ < 4) {
      if (store.time.phase === "day") {
        // 현재 낮의 남은 분 + 1로 밤으로 전환
        const remaining = Math.ceil((1 - store.time.phaseProgress) * 12 * 60);
        store.time.advanceMinutes(remaining + 1);
      } else {
        // 밤 → 아침으로
        const remaining = Math.ceil((1 - store.time.phaseProgress) * 12 * 60);
        store.time.advanceMinutes(remaining + 1);
        break; // 밤을 건너뛰면 아침 → 종료
      }
    }

    // 행동력 완전 회복
    const energyNeeded = 100 - store.stats.energy;
    if (energyNeeded > 0) store.stats.apply({ energy: energyNeeded });

    const nightBuff = store.flags.nightSkyBuff && where === "tent";
    if (nightBuff) store.flags.nightSkyBuff = false;

    const homeBaseBonus = where === "tent" && store.activeCombos.has("home_base") ? 30 : 0;

    if (where === "tent") {
      const hpGain = 40 + store.perkBonusRestHp + (nightBuff ? 20 : 0) + homeBaseBonus;
      store.stats.apply({ hp: hpGain });
      const homeMsg = homeBaseBonus > 0 ? " 🏠거점 보너스!" : "";
      store.pushLog(nightBuff
        ? `⛺ 달무리의 축복 아래 달콤하게 잠들었다. HP +${hpGain}, 행동력 완전 회복!${homeMsg}`
        : `⛺ 천막에서 편히 잠들었다. HP +${hpGain}, 행동력 완전 회복!${homeMsg}`);
    } else {
      store.stats.apply({ hp: 20 + store.perkBonusRestHp });
      store.pushLog("🚢 배 안에서 잠들었다. 체력과 행동력이 어느정도 회복됐다.");
    }
    audio.play("heal");
  }

  // ── UI ─────────────────────────────────────────────────────────
  private buildDpad(): void {
    this.dpad.removeAll(true);
    const cx = GAME_WIDTH - 120;
    const cy = 678; // center of dpad in bottom UI (힌트 공간 확보 위해 10px 위로)
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

    // Center pickup button
    const pickupBtn = makeButton(this, cx, cy, {
      label: "✋",
      width: btnSize,
      height: btnSize,
      fontSize: 24,
      bg: 0x1c2a44,
      hover: 0x2a3e5e,
      onClick: () => this.pickupAtPlayer(),
    });
    this.dpad.add(pickupBtn);
  }

  private buildMenuBar(): void {
    this.menuBar.removeAll(true);
    const buttons: Array<[string, () => void]> = [
      ["🎒 인벤(I)", () => this.toggleInventory()],
      ["🔨 제작(C)", () => this.toggleCrafting()],
      ["📖 일지(J)", () => this.toggleJournal()],
      ["💤 잠자기(Z)", () => this.trySleep()],
      ["💾 저장", () => this.manualSave()],
      ["🏠 타이틀", () => this.backToTitle()],
    ];
    // 3행 2열 그리드, 컨트롤러 영역의 왼쪽
    const bw = 130;
    const bh = 38;
    const gapX = 8;
    const gapY = 6;
    const startX = 20 + bw / 2; // left padding
    const startY = 624; // 힌트 공간 확보 위해 위로
    buttons.forEach(([label, cb], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (bw + gapX);
      const y = startY + row * (bh + gapY);
      const b = makeButton(this, x, y, {
        label,
        width: bw,
        height: bh,
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

    // 쉼터가 가까이 있는지 체크 (잠자기 버튼 힌트)
    const sleepable = this.findSleepSpot();

    if (adjacent.length > 0) {
      const names = adjacent
        .slice(0, 3)
        .map((e) => `${ENTITIES[e.type].icon}${ENTITIES[e.type].label}`)
        .join(", ");
      let line2 = "(탭하여 상호작용 | I:인벤 C:제작 J:일지";
      if (sleepable) line2 += " | Z:잠자기 💤";
      line2 += ")";
      this.actionHintText.setText(`근처: ${names}\n${line2}`);
    } else {
      let s = "화살표/D-패드 이동 | I:인벤 C:제작 J:일지";
      if (sleepable) s += " | 💤 Z:잠자기 가능";
      this.actionHintText.setText(s);
    }
  }

  /** 플레이어 인접 타일에서 잠들 수 있는 장소(설치된 천막/수색 완료된 난파선)를 찾는다. */
  private findSleepSpot(): { where: "tent" | "shipwreck"; entity: WorldEntity } | null {
    const store = getStore(this);
    const { playerTx, playerTy } = store;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const e = store.map.entityAt(playerTx + dx, playerTy + dy);
        if (!e) continue;
        if (e.type === "tent_placed") {
          return { where: "tent", entity: e };
        }
        if (e.type === "shipwreck" && (e.meta?.lootLeft ?? 0) <= 0) {
          return { where: "shipwreck", entity: e };
        }
      }
    }
    return null;
  }

  /** 잠자기 버튼/Z 키. 쉼터가 있으면 자고, 없으면 안내 메시지. */
  private trySleep(): void {
    const store = getStore(this);
    const spot = this.findSleepSpot();
    if (spot) {
      this.sleepAt(spot.where);
      this.updateActionHint();
      return;
    }
    // 없는 경우: 왜 못 자는지, 어떻게 해야 하는지 안내
    const placedTents = store.map.entities.filter((e) => e.type === "tent_placed");
    if (placedTents.length === 0) {
      const camp = store.map.entities.find((e) => e.type === "camp_spot");
      const hint = camp
        ? `   → 거점 자리(🏕)는 대략 ${camp.tx - store.playerTx > 0 ? "동" : "서"}${camp.ty - store.playerTy > 0 ? "남" : "북"}쪽에 있다.`
        : "";
      store.pushLog(
        "💤 아직 설치된 천막이 없다.\n" +
        "   → 거점 자리(🏕)로 이동해 천막(⛺)을 설치하거나, 난파선(🚢) 수색을 마치자.\n" +
        "   → 천막 제작: 천 조각×4 + 나뭇가지×6 + 밧줄×2 (C: 제작 패널)\n" +
        hint
      );
    } else {
      const t = placedTents[0];
      const dir = `${t.tx - store.playerTx > 0 ? "동" : "서"}${t.ty - store.playerTy > 0 ? "남" : "북"}`;
      store.pushLog(`💤 설치된 천막(⛺)에 인접해야 잠들 수 있다. 대략 ${dir}쪽에 있다.`);
    }
  }

  private refreshEquipBar(): void {
    const store = getStore(this);
    const weapon = store.inv.bestWeapon();
    const wDef = ITEMS[weapon.id as import("../types").ItemId];
    const hasTorch = store.inv.count("torch") > 0;
    const rod = store.inv.hasTool("rod") ? "🎣" : "";
    const lines = [
      `⚔ ${wDef?.icon ?? "✊"} ${wDef?.name ?? "맨손"} (${weapon.dmg} dmg)`,
      hasTorch ? "🔥 횃불 보유" : "🌑 횃불 없음",
      rod ? `${rod} 낚싯대 보유` : "",
    ].filter(Boolean);
    this.equipBarText.setText(lines.join("\n"));
  }

  private updateNightOverlay(): void {
    const store = getStore(this);
    if (store.time.phase !== "night") {
      this.tweens.add({ targets: this.nightOverlay, fillAlpha: 0, duration: 1500 });
      return;
    }
    const hasTorch = store.inv.count("torch") > 0;
    const targetAlpha = hasTorch ? 0.18 : 0.52;
    this.tweens.add({ targets: this.nightOverlay, fillAlpha: targetAlpha, duration: 2000 });
  }

  /** 매 프레임 호출: 설치된 광원 주변의 밝기를 그린다. */
  update(): void {
    this.drawLightSources();
  }

  private drawLightSources(): void {
    if (!this.lightsGfx) return;
    this.lightsGfx.clear();
    const store = getStore(this);
    // 낮이면 광원이 필요 없음
    if (store.time.phase !== "night") return;

    const sources = store.getLightSources();
    if (sources.length === 0) return;

    const camX = this.worldCam.scrollX;
    const camY = this.worldCam.scrollY;

    for (const s of sources) {
      // 월드→스크린 변환 (worldCam 뷰포트가 VP_X/Y에서 시작)
      const sx = s.tx * TILE_PX + TILE_PX / 2 - camX + VP_X;
      const sy = s.ty * TILE_PX + TILE_PX / 2 - camY + VP_Y;

      // 뷰포트 바깥이면 그릴 필요 없음
      if (sx < VP_X - 120 || sx > VP_X + VP_W + 120) continue;
      if (sy < VP_Y - 120 || sy > VP_Y + VP_H + 120) continue;

      // 바깥 → 안쪽 순으로 겹쳐 그려 은은한 그라디언트 효과
      const baseColor = s.type === "bonfire_placed" ? 0xffb060 : 0xaec7ff;
      const flicker = s.type === "bonfire_placed" ? 1 + Math.sin(this.time.now * 0.012 + s.id) * 0.06 : 1;

      // 3단 그림자: 외곽(어둠 해제) → 중간 → 중심(가장 밝음)
      const rings: Array<[number, number]> = [
        [TILE_PX * 2.8 * flicker, 0.10],
        [TILE_PX * 2.0 * flicker, 0.16],
        [TILE_PX * 1.2 * flicker, 0.28],
        [TILE_PX * 0.55 * flicker, 0.35],
      ];
      for (const [r, a] of rings) {
        this.lightsGfx.fillStyle(baseColor, a);
        this.lightsGfx.fillCircle(sx, sy, r);
      }
    }
  }

  // ── Combat triggers ────────────────────────────────────────────
  private triggerSeaBoss(day: number): void {
    const store = getStore(this);
    const idx = Math.min(SEA_BOSSES.length - 1, Math.floor(day / 10) - 1);
    const baseBoss = SEA_BOSSES[idx];

    // 점화된 봉화대 개수에 따라 보스 능력치 감소
    // - 1개: 20%, 2개: 40%, 봉화망(3개+): 70% (콤보 발동)
    const litCount = store.map.entities.filter((e) => e.type === "signal_fire_lit").length;
    const debuffPct = store.activeCombos.has("signal_network") ? 70 : Math.min(40, litCount * 20);
    const boss: EnemyDef = debuffPct > 0
      ? {
          ...baseBoss,
          hp: Math.round(baseBoss.hp * (1 - debuffPct / 100)),
          atk: Math.round(baseBoss.atk * (1 - debuffPct / 100)),
          name: `${baseBoss.name} (약화)`,
        }
      : baseBoss;

    store.pushLog(`⚠ ${baseBoss.name}이(가) 해안에 나타났다!`);
    if (debuffPct > 0) {
      store.pushLog(`🗼 점화된 봉화 ${litCount}개의 빛이 괴물을 방해한다. HP·공격력 ${debuffPct}% 감소.`);
      // 봉화는 1회성 — 점화된 봉화는 꺼져서 사라진다
      for (const e of [...store.map.entities]) {
        if (e.type === "signal_fire_lit") store.map.removeEntity(e.id);
      }
      this.renderEntities();
    }
    audio.play("boss_alert");
    this.triggerCombat(boss);
  }

  /** 뗏목 탈출 시도 — 충분한 보급품이 있으면 VictoryScene(raft) 분기 */
  private tryRaftEscape(_entity: WorldEntity): void {
    const store = getStore(this);
    const COOKED_FOODS: import("../types").ItemId[] = [
      "can_food", "meat_cooked", "fish_cooked",
      "smoked_fish", "meat_stew", "trail_mix",
    ];
    const waterCount = store.inv.count("water_clean");
    const foodCount = COOKED_FOODS.reduce((acc, id) => acc + store.inv.count(id), 0);
    const waterOK = waterCount >= 5;
    const foodOK = foodCount >= 8;

    if (!waterOK || !foodOK) {
      store.pushLog(
        "⛵ 뗏목 위에 올랐지만 항해 보급품이 부족하다.\n" +
        `   💧 정화수 ${waterCount}/5 ${waterOK ? "✓" : "✗"}\n` +
        `   🍖 조리된 음식 (통조림·구운 것 등) ${foodCount}/8 ${foodOK ? "✓" : "✗"}`
      );
      return;
    }

    // 보급품 소비
    store.inv.remove("water_clean", 5);
    let needFood = 8;
    for (const id of COOKED_FOODS) {
      const have = store.inv.count(id);
      if (have <= 0) continue;
      const take = Math.min(have, needFood);
      store.inv.remove(id, take);
      needFood -= take;
      if (needFood <= 0) break;
    }

    store.pushLog("⛵ 뗏목을 띄웠다! 파도가 섬을 멀리 밀어낸다...");
    audio.play("victory");
    this.cameras.main.fadeOut(1500, 0, 0, 0);
    this.time.delayedCall(1600, () => {
      this.scene.stop("HUDScene");
      this.scene.start("VictoryScene", { raftEscape: true, days: store.time.day });
    });
  }

  /** 바다에 띄운 유리병의 귀환 처리. dayChange마다 호출. */
  private processBottleReturn(): void {
    const store = getStore(this);
    const sent = store.flags.sentBottle;
    if (!sent) return;
    const elapsed = store.time.day - sent.sentDay;
    if (elapsed < 2) return;
    // 2일 뒤: 60% 복귀, 3일 뒤: 100% 복귀
    if (elapsed === 2 && Math.random() < 0.4) return; // 하루 더 기다려봄

    if (Math.random() < 0.15) {
      store.pushLog("🫙 띄워 보낸 유리병이 끝내 돌아오지 않았다...");
    } else {
      const rewards = this.bottleRewardFor(sent.itemId);
      for (const r of rewards) {
        store.inv.add(r.id, r.count);
        store.discoverRecipes(r.id);
      }
      const txt = rewards.map((r) => `${ITEMS[r.id].icon}${ITEMS[r.id].name}×${r.count}`).join(", ");
      store.pushLog(`🫙 파도에 유리병이 떠밀려왔다! 안에서 ${txt}을(를) 발견했다.`);
      this.spawnPickupFx(store.playerTx, store.playerTy - 1, "🫙✨", "#a0e0ff");
      audio.play("pickup");
    }
    store.flags.sentBottle = undefined;
  }

  /** 보낸 아이템의 희귀도에 따라 돌아올 보상 풀. */
  private bottleRewardFor(sent: ItemId): Array<{ id: ItemId; count: number }> {
    const basicPool: Array<{ id: ItemId; count: number }[]> = [
      [{ id: "rope", count: 2 }, { id: "cloth", count: 2 }],
      [{ id: "bandage", count: 2 }, { id: "berry", count: 3 }],
      [{ id: "stick", count: 6 }, { id: "vine", count: 4 }],
    ];
    const midPool: Array<{ id: ItemId; count: number }[]> = [
      [{ id: "iron_ore", count: 3 }, { id: "rope", count: 2 }],
      [{ id: "bullet", count: 8 }, { id: "cloth", count: 3 }],
      [{ id: "fishing_rod", count: 1 }, { id: "bandage", count: 2 }],
      [{ id: "treasure_map", count: 1 }, { id: "can_food", count: 2 }],
    ];
    const rarePool: Array<{ id: ItemId; count: number }[]> = [
      [{ id: "iron_sword", count: 1 }, { id: "large_bandage", count: 1 }],
      [{ id: "medkit", count: 1 }, { id: "energy_tonic", count: 1 }],
      [{ id: "diamond", count: 2 }, { id: "treasure_map", count: 2 }],
      [{ id: "blanket", count: 1 }, { id: "smoked_fish", count: 3 }],
    ];

    const tierByItem: Record<string, "basic" | "mid" | "rare"> = {
      stick: "basic", stone: "basic", vine: "basic", cloth: "basic",
      berry: "basic", mushroom: "basic", seed: "basic",
      rope: "mid", metal_scrap: "mid", iron_ore: "mid", bullet: "mid",
      bandage: "mid",
      diamond: "rare", herbal_drink: "rare",
    };
    const tier = tierByItem[sent] ?? "basic";
    const pool = tier === "rare" ? rarePool : tier === "mid" ? midPool : basicPool;
    return Phaser.Utils.Array.GetRandom(pool) as Array<{ id: ItemId; count: number }>;
  }

  /** 심은 씨앗(planted_seed)을 심은 지 2일 뒤 ripe_plant로 변환.
   *  🌾 텃밭 콤보 활성 시 1일 만에 성장. */
  private matureGardenPlants(): void {
    const store = getStore(this);
    const requiredDays = store.activeCombos.has("farm") ? 1 : 2;
    let matured = 0;
    for (const e of store.map.entities) {
      if (e.type === "planted_seed") {
        const planted = e.meta?.plantedDay ?? store.time.day;
        if (store.time.day - planted >= requiredDays) {
          e.type = "ripe_plant";
          matured++;
        }
      }
    }
    if (matured > 0) {
      const fastNote = requiredDays === 1 ? " (🌾텃밭 가속)" : "";
      store.pushLog(`🌿 심어놓은 새싹 ${matured}개가 수확 가능한 상태로 자랐다.${fastNote}`);
      this.renderEntities();
    }
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
    else this.inventoryPanel.open((id) => {
      if (id === "treasure_map") this.revealTreasure();
      if (id === "glass_bottle") this.bottleTradePanel.open();
      this.renderEntities();
      this.updateActionHint();
    });
  }

  /** 낡은 지도 사용 시: 섬 어딘가의 빈 타일에 buried_treasure 엔티티를 생성하고 방향 힌트를 준다. */
  private revealTreasure(): void {
    const store = getStore(this);
    const map = store.map;
    for (let i = 0; i < 300; i++) {
      const tx = Math.floor(Math.random() * map.size);
      const ty = Math.floor(Math.random() * map.size);
      const t = map.terrainAt(tx, ty);
      if (t !== "grass" && t !== "sand" && t !== "forest") continue;
      if (map.entityAt(tx, ty)) continue;
      // 너무 가까우면 별로 재미없음 — 최소 8칸은 떨어지게
      const d = Math.max(Math.abs(tx - store.playerTx), Math.abs(ty - store.playerTy));
      if (d < 8) continue;
      let maxId = 0;
      for (const e of map.entities) if (e.id > maxId) maxId = e.id;
      map.entities.push({ id: maxId + 1, type: "buried_treasure", tx, ty });
      const dx = tx - store.playerTx;
      const dy = ty - store.playerTy;
      const ns = dy < 0 ? "북" : "남";
      const ew = dx < 0 ? "서" : "동";
      const approxDist = Math.round(Math.sqrt(dx * dx + dy * dy));
      store.pushLog(`🗺 지도를 펼쳤다. 보물은 ${ns}${ew}쪽 약 ${approxDist}칸 거리 (${t === "sand" ? "해변" : t === "forest" ? "숲 안쪽" : "풀밭"})에 묻혀있다.`);
      store.pushLog("💡 곡괭이(⛏)를 들고 찾아가 파내보자.");
      audio.play("menu");
      return;
    }
    store.pushLog("🗺 지도가 너무 낡아 아무것도 읽을 수 없었다.");
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

  /** 낚시 미니게임: 찌가 잠기면 제때 버튼 클릭 */
  private startFishing(fishTx: number, fishTy: number): void {
    const store = getStore(this);
    store.time.advanceMinutes(20);
    store.stats.apply({ energy: -4 });
    store.pushLog("🎣 낚싯대를 드리웠다. 찌가 잠기면 '낚아채기!' 버튼을 눌러라!");

    const PW = 400;
    const PH = 320;
    const PX = (GAME_WIDTH - PW) / 2;
    const PY = (GAME_HEIGHT - PH) / 2;

    const c = this.add.container(0, 0).setDepth(250);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setOrigin(0, 0).setInteractive();
    c.add(overlay);

    const bg = this.add.graphics();
    bg.fillStyle(0x050d28, 0.97);
    bg.fillRoundedRect(PX, PY, PW, PH, 16);
    bg.lineStyle(2, COLORS.accent, 0.8);
    bg.strokeRoundedRect(PX, PY, PW, PH, 16);
    c.add(bg);

    const titleTxt = this.add.text(PX + PW / 2, PY + 26, "🎣 낚시 중...", {
      fontFamily: "Galmuri11, monospace", fontSize: "22px", color: "#cfd8ff",
    }).setOrigin(0.5);
    c.add(titleTxt);

    // 낚싯줄 + 찌 애니메이션
    const lineGfx = this.add.graphics();
    c.add(lineGfx);
    const bobberCx = PX + PW / 2;
    const bobberBaseY = PY + 160;
    const bobber = this.add.text(bobberCx, bobberBaseY, "🔵", { fontSize: "24px" }).setOrigin(0.5);
    c.add(bobber);

    const drawLine = (bY: number) => {
      lineGfx.clear();
      lineGfx.lineStyle(2, 0xaaddff, 0.7);
      lineGfx.beginPath();
      lineGfx.moveTo(PX + PW / 2, PY + 70);
      lineGfx.lineTo(bobberCx, bY - 10);
      lineGfx.strokePath();
    };
    drawLine(bobberBaseY);

    // 찌가 위아래로 살살 움직임
    const idleTween = this.tweens.add({
      targets: bobber,
      y: bobberBaseY + 10,
      duration: 800,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
      onUpdate: () => drawLine(bobber.y),
    });

    const statusTxt = this.add.text(PX + PW / 2, PY + 210, "찌를 지켜봐라...", {
      fontFamily: "Galmuri11, monospace", fontSize: "15px", color: "#8d9bd1",
    }).setOrigin(0.5);
    c.add(statusTxt);

    // 낚아채기 버튼 (처음엔 비활성)
    let canCatch = false;
    const catchBtn = makeButton(this, PX + PW / 2, PY + PH - 52, {
      label: "낚아채기! 🎣",
      width: 200,
      height: 52,
      fontSize: 18,
      bg: 0x1a3a1a,
      hover: 0x2a5a2a,
      border: 0x3a8a3a,
      textColor: "#88cc88",
      onClick: () => {
        if (!canCatch) return;
        clearTimeout(missTimer);
        idleTween.stop();
        c.destroy();
        this.grantFishLoot(fishTx, fishTy);
      },
      disabled: true,
    }) as ButtonNode;
    c.add(catchBtn);

    const cancelBtn = makeButton(this, PX + PW - 32, PY + 24, {
      label: "✕",
      width: 44,
      height: 36,
      fontSize: 18,
      bg: 0x2a0f18,
      hover: 0x4a1520,
      border: 0x8a2230,
      onClick: () => {
        clearTimeout(missTimer);
        idleTween.stop();
        c.destroy();
        store.pushLog("🎣 낚시를 그만뒀다.");
        this.renderEntities();
      },
    });
    c.add(cancelBtn);

    // 월드 카메라 무시
    this.worldCam.ignore(c);

    // 무작위 1.5~4초 뒤 찌가 잠김
    const waitMs = 1500 + Math.random() * 2500;
    let missTimer: ReturnType<typeof setTimeout>;

    this.time.delayedCall(waitMs, () => {
      idleTween.stop();
      // 찌 급격히 아래로 ↓ (bite 애니메이션)
      this.tweens.add({
        targets: bobber,
        y: bobberBaseY + 28,
        duration: 180,
        ease: "Bounce.Out",
        onUpdate: () => drawLine(bobber.y),
      });
      bobber.setText("🟣");
      statusTxt.setText("‼ 낚아채기!");
      statusTxt.setStyle({ color: "#ffdd44", fontSize: "20px" });

      // 버튼 활성화
      canCatch = true;
      catchBtn.setDisabled(false);
      (catchBtn as any).setLabel("낚아채기! ⬇️");

      // 1.5초 (+fish5 특성 0.5초) 내에 안 누르면 실패
      const catchWindowMs = 1500 + store.perkFishExtraMs;
      missTimer = setTimeout(() => {
        idleTween.stop();
        c.destroy();
        store.pushLog("🎣 아뿔싸! 찌를 늦게 당겼다. 물고기가 도망쳤다.");
      }, catchWindowMs);
    });
  }

  private grantFishLoot(tx: number, ty: number): void {
    const store = getStore(this);
    const r = Math.random() + store.perkRareDropBonus;
    if (r < 0.55) {
      const n = Phaser.Math.Between(1, 2);
      store.inv.add("fish_raw", n);
      store.pushLog(`🐟 낚시 성공! 생 물고기 ×${n} 획득!`);
      this.spawnPickupFx(tx, ty, `+🐟×${n}`);
      store.discoverRecipes("fish_raw");
    } else if (r < 0.75) {
      const n = Phaser.Math.Between(1, 2);
      store.inv.add("fish_cooked", n);
      store.pushLog(`🍤 운이 좋다! 구운 생선 ×${n} 획득!`);
      this.spawnPickupFx(tx, ty, `+🍤×${n}`);
      store.discoverRecipes("fish_cooked");
    } else if (r < 0.88) {
      store.inv.add("water_clean", 1);
      store.pushLog("💧 이상하게도 맑은 물이 담긴 조개껍데기가 올라왔다. 정화수 ×1.");
      this.spawnPickupFx(tx, ty, "+💧×1", "#9fd5ff");
    } else if (r < 0.96) {
      store.inv.add("metal_scrap", 1);
      store.pushLog("⛓ 낚싯줄에 금속 조각이 걸려왔다. 금속 조각 ×1.");
    } else {
      store.inv.add("diamond", 1);
      store.pushLog("💎 낚시 대박! 강바닥에서 다이아몬드가 올라왔다!");
      this.spawnPickupFx(tx, ty, "+💎×1", "#a0e0ff");
    }
    // fish5 achievement tracking
    store.flags.fishCaught = (store.flags.fishCaught ?? 0) + 1;
    if (store.flags.fishCaught >= 5) store.unlockAchievement("fish5");
    audio.play("water_splash");

    // 낚싯대 내구도 감소
    const rodSlot = store.inv.findToolSlot("rod");
    if (rodSlot >= 0) {
      const rodItem = store.inv.slots[rodSlot];
      const rodName = rodItem ? ITEMS[rodItem.id].name : "낚싯대";
      const res = store.inv.useDurability(rodSlot);
      if (res.broken) {
        store.pushLog(`💥 ${rodName}이(가) 끊어졌다!`);
      } else if (res.hasDurability && res.dur! <= 3) {
        store.pushLog(`⚠ ${rodName} 내구도 ${res.dur}/${res.max}`);
      }
    }

    this.renderEntities();
    this.updateActionHint();
  }

  resumeFromOverlay(): void {
    this.renderEntities();
    this.updateActionHint();
    this.syncBgm();
  }

  // ── 동적 요소 ─────────────────────────────────────────────────────
  /** 토끼 같은 동물이 근처 타일로 가끔 이동한다. */
  private setupWildlifeAI(): void {
    this.time.addEvent({
      delay: 2400,
      loop: true,
      callback: () => this.tickWildlife(),
    });
  }

  private tickWildlife(): void {
    // 씬이 일시정지 상태면 아무것도 하지 않음
    if (this.scene.isPaused()) return;
    const store = getStore(this);
    const rabbits = store.map.entities.filter((e) => e.type === "rabbit");
    for (const r of rabbits) {
      // 각 토끼는 50% 확률로 움직임 시도
      if (Math.random() < 0.5) continue;
      const dirs: Array<[number, number]> = [
        [0, -1], [0, 1], [-1, 0], [1, 0],
      ];
      Phaser.Utils.Array.Shuffle(dirs);
      for (const [dx, dy] of dirs) {
        const nx = r.tx + dx;
        const ny = r.ty + dy;
        if (!store.map.isPassable(nx, ny)) continue;
        // 플레이어와 같은 타일은 피함
        if (nx === store.playerTx && ny === store.playerTy) continue;
        const sprite = this.entityObjects.get(r.id);
        if (!sprite) continue;
        r.tx = nx;
        r.ty = ny;
        this.tweens.add({
          targets: sprite,
          x: nx * TILE_PX + TILE_PX / 2,
          y: ny * TILE_PX + TILE_PX / 2,
          duration: 260,
          ease: "Sine.InOut",
        });
        break;
      }
    }
  }

  /** 월드 위로 떠다니는 구름 그림자. */
  private setupClouds(): void {
    const cloudCount = 4;
    for (let i = 0; i < cloudCount; i++) {
      this.spawnCloud(Math.random() * WORLD_PX);
    }
  }

  private spawnCloud(startX: number): void {
    const y = Math.random() * WORLD_PX;
    const scale = 1.2 + Math.random() * 1.6;
    const cloud = this.add
      .text(startX, y, "☁", { fontSize: "48px" })
      .setOrigin(0.5)
      .setAlpha(0.35 + Math.random() * 0.2)
      .setDepth(15)
      .setScale(scale);
    this.worldObjects.push(cloud);
    this.uiCam.ignore(cloud);
    const dur = 60000 + Math.random() * 60000;
    this.tweens.add({
      targets: cloud,
      x: startX + WORLD_PX + 200,
      duration: dur,
      ease: "Linear",
      onComplete: () => {
        cloud.destroy();
        this.spawnCloud(-200 - Math.random() * 400);
      },
    });
  }

  /** 가끔 날씨가 변한다 (비/바람). 비는 화면 전체에 내린다. */
  private setupWeather(): void {
    this.time.addEvent({
      delay: 90000, // 1.5분마다 날씨 굴림
      loop: true,
      callback: () => {
        if (this.scene.isPaused()) return;
        const roll = Math.random();
        if (roll < 0.18) this.startRain();
        else if (roll < 0.3) this.startWind();
      },
    });
  }

  private startRain(): void {
    const store = getStore(this);
    store.pushLog("🌧 하늘이 어두워지더니 비가 내리기 시작한다.");
    audio.play("phase_night");
    const duration = 35000;
    const particles: Phaser.GameObjects.Text[] = [];
    const spawn = () => {
      for (let i = 0; i < 3; i++) {
        const px = Math.random() * GAME_WIDTH;
        const d = this.add
          .text(px, VP_Y - 10, "│", {
            fontSize: "14px",
            color: "#9fd5ff",
          })
          .setAlpha(0.55)
          .setDepth(45);
        this.worldCam.ignore(d);
        particles.push(d);
        this.tweens.add({
          targets: d,
          y: VP_Y + VP_H,
          alpha: 0,
          duration: 420 + Math.random() * 180,
          ease: "Linear",
          onComplete: () => d.destroy(),
        });
      }
    };
    const spawner = this.time.addEvent({ delay: 80, loop: true, callback: spawn });
    this.time.delayedCall(duration, () => {
      spawner.remove(false);
      particles.forEach((p) => p.destroy());
      // 비 보너스: 더러운 물 1-2 추가 (빈 용기 같이)
      if (Math.random() < 0.75) {
        const n = Phaser.Math.Between(1, 2);
        store.inv.add("water_dirty", n);
        store.pushLog(`🌧 비가 그쳤다. 받아둔 빗물 (흙탕물 ×${n}) 획득.`);
      } else {
        store.pushLog("🌦 비가 그쳤다.");
      }
    });
  }

  private startWind(): void {
    const store = getStore(this);
    store.pushLog("🍃 해안에서 상쾌한 바람이 불어온다. 기분이 좋아진다.");
    store.stats.apply({ energy: 6 });
    // 바람 이펙트: 작은 잎사귀 몇 개 화면 가로질러 이동
    for (let i = 0; i < 8; i++) {
      const startY = VP_Y + Math.random() * VP_H;
      const leaf = this.add
        .text(-20, startY, Math.random() < 0.5 ? "🍃" : "·", { fontSize: "16px" })
        .setDepth(45)
        .setAlpha(0.8);
      this.worldCam.ignore(leaf);
      this.tweens.add({
        targets: leaf,
        x: GAME_WIDTH + 20,
        y: startY + (Math.random() - 0.5) * 80,
        duration: 3500 + Math.random() * 1500,
        delay: i * 200,
        ease: "Sine.InOut",
        onComplete: () => leaf.destroy(),
      });
    }
  }

  /** 매일 아침 무작위 이벤트 롤. */
  private setupRandomEvents(): void {
    const store = getStore(this);
    store.time.on("dayChange", () => {
      if (Math.random() < 0.55) {
        this.time.delayedCall(2500, () => this.rollMorningEvent());
      }
    });
  }

  private rollMorningEvent(): void {
    const store = getStore(this);
    const events: Array<() => void> = [
      () => {
        // 갈매기가 물고기를 떨어뜨림
        store.inv.add("fish_raw", 1);
        store.pushLog("🕊 갈매기 한 마리가 머리 위를 지나가며 생 물고기를 떨어뜨렸다!");
        this.spawnPickupFx(store.playerTx, store.playerTy - 1, "+🐟×1", "#9fd5ff");
        audio.play("pickup");
      },
      () => {
        // 해안가 유리병 편지
        store.pushLog("🫙 해변에 유리병이 떠밀려왔다. 안에는 오래된 기도문이 있다. 마음이 차분해진다.");
        store.stats.apply({ energy: 12, hp: 4 });
      },
      () => {
        // 야생 꿀벌의 선물 - 열매
        const n = Phaser.Math.Between(2, 3);
        store.inv.add("berry", n);
        store.pushLog(`🐝 꿀벌들이 발견한 열매를 나누어준다. 열매 ×${n}.`);
        this.spawnPickupFx(store.playerTx, store.playerTy - 1, `+🫐×${n}`);
        audio.play("pickup");
      },
      () => {
        // 토끼가 둥지에 남긴 덩굴
        const n = Phaser.Math.Between(2, 3);
        store.inv.add("vine", n);
        store.pushLog(`🐇 토끼가 둥지에 남긴 덩굴 뭉치를 발견했다. 덩굴 ×${n}.`);
        this.spawnPickupFx(store.playerTx, store.playerTy - 1, `+🌿×${n}`);
        audio.play("pickup");
      },
      () => {
        // 기묘한 꿈
        store.pushLog("💭 지난밤 꿈에서 구조선을 보았다. 왠지 의지가 솟구친다.");
        store.stats.apply({ energy: 20 });
      },
      () => {
        // 낡은 보물 지도가 든 유리병
        store.inv.add("treasure_map", 1);
        store.pushLog("🫙 파도에 떠밀려온 유리병 안에서 낡은 보물 지도(🗺)를 발견했다!");
        this.spawnPickupFx(store.playerTx, store.playerTy - 1, "+🗺×1", "#ffd97a");
        audio.play("pickup");
      },
      () => {
        // 해풍 속 표류물
        if (Math.random() < 0.5) {
          store.inv.add("metal_scrap", 2);
          store.pushLog("⚙ 아침 해안에 금속 조각이 떠밀려왔다. 금속 조각 ×2.");
        } else {
          store.inv.add("cloth", 2);
          store.pushLog("🧵 바람에 실려온 낡은 천 조각을 주웠다. 천 조각 ×2.");
        }
        audio.play("pickup");
      },
      () => {
        // 빈 유리병 표류 — 유리병 무역의 입구
        store.inv.add("glass_bottle", 1);
        store.pushLog("🫙 해변에 빈 유리병이 떠밀려왔다. 인벤토리에서 재료를 담아 띄우면 선물이 돌아올지도...");
        this.spawnPickupFx(store.playerTx, store.playerTy - 1, "+🫙×1", "#a0e0ff");
        audio.play("pickup");
      },
    ];
    const pick = Phaser.Utils.Array.GetRandom(events) as () => void;
    pick();
  }
}
