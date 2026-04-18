import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, ZONE_TRAVEL_MINUTES, WIN_DAY } from "../config";
import { ZONES, ZONE_ADJACENCY } from "../data/zones";
import { ACTIONS } from "../data/resources";
import { ITEMS } from "../data/items";
import { SEA_BOSSES, NIGHT_MOBS, DAY_GAME } from "../data/enemies";
import type { ZoneId, ZoneActionId, EnemyDef } from "../types";
import { getStore } from "../systems/GameStore";
import { makeButton, type ButtonNode } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { InventoryPanel } from "../ui/InventoryPanel";
import { CraftingPanel } from "../ui/CraftingPanel";
import { JournalPanel } from "../ui/JournalPanel";

export class WorldScene extends Phaser.Scene {
  private sceneContainer!: Phaser.GameObjects.Container;
  private actionBar!: Phaser.GameObjects.Container;
  private moveBar!: Phaser.GameObjects.Container;
  private menuBar!: Phaser.GameObjects.Container;
  private zoneTitle!: Phaser.GameObjects.Text;
  private zoneDesc!: Phaser.GameObjects.Text;

  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;
  private journalPanel!: JournalPanel;

  private bg!: Phaser.GameObjects.Graphics;
  private decorContainer!: Phaser.GameObjects.Container;
  private hero!: Phaser.GameObjects.Text;

  constructor() {
    super("WorldScene");
  }

  create(): void {
    const store = getStore(this);
    const cam = this.cameras.main;
    cam.fadeIn(500, 0, 0, 0);

    this.sceneContainer = this.add.container(0, 0);
    this.bg = this.add.graphics();
    this.decorContainer = this.add.container(0, 0);

    // 상단 HUD가 56px 차지. 가용 영역 56 ~ GAME_HEIGHT-230 정도.
    // 씬 타이틀
    this.zoneTitle = this.add
      .text(GAME_WIDTH / 2, 84, "", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "32px",
        color: "#eaf0ff",
        stroke: "#0b2040",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.zoneDesc = this.add
      .text(GAME_WIDTH / 2, 120, "", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "14px",
        color: "#9fb7ff",
      })
      .setOrigin(0.5);

    // 주인공
    this.hero = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 310, "🧑", { fontSize: "56px" }).setOrigin(0.5);
    this.tweens.add({ targets: this.hero, y: this.hero.y - 6, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    // 바닥 패널
    drawPanel(this, 0, GAME_HEIGHT - 220, GAME_WIDTH, 220, { fill: 0x060a18, alpha: 0.95 });

    // 버튼 컨테이너들
    this.actionBar = this.add.container(0, 0);
    this.moveBar = this.add.container(0, 0);
    this.menuBar = this.add.container(0, 0);

    this.inventoryPanel = new InventoryPanel(this);
    this.craftingPanel = new CraftingPanel(this);
    this.journalPanel = new JournalPanel(this);

    // 전역 메뉴
    this.buildMenuBar();

    // 이벤트 바인딩
    store.time.on("phaseChange", () => this.renderZone());
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

    this.renderZone();

    // 디버그 키
    this.input.keyboard?.on("keydown-I", () => this.toggleInventory());
    this.input.keyboard?.on("keydown-C", () => this.toggleCrafting());
    this.input.keyboard?.on("keydown-J", () => this.toggleJournal());

    // 첫 진입 안내
    if (Object.keys(store.flags.firstTimeVisited).length === 0) {
      store.pushLog("파도에 떠밀려 해변에 도착했다. 먼저 주변을 둘러보자.");
    }
  }

  private buildMenuBar(): void {
    this.menuBar.removeAll(true);
    const y = GAME_HEIGHT - 40;
    const buttons: Array<[string, () => void]> = [
      ["🎒 인벤 (I)", () => this.toggleInventory()],
      ["🔨 제작 (C)", () => this.toggleCrafting()],
      ["📖 일지 (J)", () => this.toggleJournal()],
      ["💾 저장", () => this.manualSave()],
      ["🏠 타이틀", () => this.backToTitle()],
    ];
    const bw = 170;
    const gap = 10;
    const total = buttons.length * bw + (buttons.length - 1) * gap;
    const startX = (GAME_WIDTH - total) / 2 + bw / 2;
    buttons.forEach(([label, cb], i) => {
      const b = makeButton(this, startX + i * (bw + gap), y, { label, width: bw, height: 40, fontSize: 13, onClick: cb });
      this.menuBar.add(b);
    });
  }

  private renderZone(): void {
    const store = getStore(this);
    const zone = ZONES[store.currentZone];

    store.flags.firstTimeVisited[store.currentZone] = true;

    // 배경 그라디언트
    this.bg.clear();
    const pal = zone.palette;
    const top = store.time.phase === "day" ? pal.dayTop : pal.nightTop;
    const bot = store.time.phase === "day" ? pal.dayBot : pal.nightBot;
    this.bg.fillGradientStyle(top, top, bot, bot, 1);
    this.bg.fillRect(0, 56, GAME_WIDTH, GAME_HEIGHT - 276);

    // 장식 이모지를 흩뿌림
    this.decorContainer.removeAll(true);
    const decorCount = 14;
    for (let i = 0; i < decorCount; i++) {
      const ch = zone.decor[i % zone.decor.length];
      const ex = Phaser.Math.Between(80, GAME_WIDTH - 80);
      const ey = Phaser.Math.Between(150, GAME_HEIGHT - 260);
      const scale = Phaser.Math.FloatBetween(0.6, 1.6);
      const alpha = Phaser.Math.FloatBetween(0.5, 1);
      const t = this.add.text(ex, ey, ch, { fontSize: `${Math.round(36 * scale)}px` }).setAlpha(alpha);
      this.decorContainer.add(t);
    }
    // 바닥선
    const groundY = GAME_HEIGHT - 248;
    const ground = this.add.rectangle(GAME_WIDTH / 2, groundY, GAME_WIDTH, 4, 0x000000, 0.25);
    this.decorContainer.add(ground);

    this.zoneTitle.setText(`${zone.short} · ${zone.name}`);
    const desc = this.zoneDescription(store.currentZone);
    this.zoneDesc.setText(desc);

    // 주인공 위치 리셋
    this.hero.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 300);

    this.buildActionBar();
    this.buildMoveBar();
  }

  private zoneDescription(id: ZoneId): string {
    const store = getStore(this);
    const phase = store.time.phase;
    switch (id) {
      case "beach":
        return phase === "day" ? "파도가 잔잔하다. 멀리 좌초된 배가 보인다." : "달빛이 모래를 비춘다. 이따금 무언가의 기척이 느껴진다.";
      case "shipwreck":
        return "반파된 선체가 해안에 기울어져 있다. 쓸 만한 것이 남아 있을지도 모른다.";
      case "forest":
        return phase === "day" ? "새소리와 함께 나무 사이로 햇살이 스며든다." : "나뭇가지 사이에서 무언가가 지켜보는 듯하다.";
      case "river":
        return "맑은 물이 흐른다. 물고기의 그림자가 보인다.";
      case "cave_entrance":
        return "축축한 바람이 동굴에서 새어나온다.";
      case "cave_interior":
        return `깊이 ${store.caveDepth}층. 횃불 없이는 한 치 앞이 보이지 않는다.`;
      case "cliff":
        return "수평선이 한눈에 들어온다. 구조선은 아직 보이지 않는다.";
      case "camp":
        return `${store.flags.hasBonfire ? "🔥 모닥불이 타오른다. " : ""}${store.flags.hasTent ? "⛺ 천막이 바람을 막아준다." : ""}`;
    }
  }

  private buildActionBar(): void {
    this.actionBar.removeAll(true);
    const store = getStore(this);
    const zone = ZONES[store.currentZone];
    const y = GAME_HEIGHT - 170;
    const label = this.add.text(60, y - 34, "행동", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#8d9bd1",
    });
    this.actionBar.add(label);

    const bw = 160;
    const gap = 10;
    let x = 70;
    for (const aid of zone.actions) {
      const act = ACTIONS[aid];
      let disabled = false;
      let reason = "";
      if (act.onlyPhase && act.onlyPhase !== store.time.phase) {
        disabled = true;
        reason = act.onlyPhase === "day" ? "(낮에만)" : "(밤에만)";
      }
      if (act.requiresTool && !store.inv.hasTool(act.requiresTool)) {
        disabled = true;
        reason = `(${act.requiresTool === "rod" ? "낚싯대" : act.requiresTool === "pickaxe" ? "곡괭이" : "도끼"} 필요)`;
      }
      if (aid === "enter_cave" && store.time.day < 1) {
        disabled = true;
      }
      if (aid === "sleep" && !store.flags.hasTent && store.currentZone === "camp") {
        // 거점에서만 잠 가능, 천막이 있으면 숙면
      }
      if (aid === "loot_crate" && store.flags.lootedCrates >= 3) {
        disabled = true;
        reason = "(모두 수색됨)";
      }
      const btn = makeButton(this, x + bw / 2, y, {
        label: `${act.icon} ${act.label}${reason ? " " + reason : ""}`,
        width: bw,
        height: 44,
        fontSize: 13,
        disabled,
        onClick: () => this.doAction(aid),
      });
      this.actionBar.add(btn);
      x += bw + gap;
    }
  }

  private buildMoveBar(): void {
    this.moveBar.removeAll(true);
    const store = getStore(this);
    const from = store.currentZone;
    const adj = ZONE_ADJACENCY[from];
    const y = GAME_HEIGHT - 112;
    const label = this.add.text(60, y - 34, "이동", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#8d9bd1",
    });
    this.moveBar.add(label);

    const bw = 150;
    const gap = 10;
    let x = 70;
    for (const id of adj) {
      const zone = ZONES[id];
      let locked = false;
      let tip = "";
      if (zone.unlock && !zone.unlock({
        day: store.time.day,
        hour: store.time.hour,
        phase: store.time.phase,
        stats: store.stats,
        inventory: store.inv.slots,
        equipped: {},
        flags: store.flags,
        currentZone: store.currentZone,
        caveDepth: store.caveDepth,
      })) {
        locked = true;
        if (id === "cliff") tip = " (밧줄 필요)";
        if (id === "camp") tip = " (거점 구축 필요)";
      }
      const btn = makeButton(this, x + bw / 2, y, {
        label: `→ ${zone.short}${tip}`,
        width: bw,
        height: 44,
        fontSize: 13,
        disabled: locked,
        onClick: () => this.travelTo(id),
      });
      this.moveBar.add(btn);
      x += bw + gap;
    }
  }

  private travelTo(zoneId: ZoneId): void {
    const store = getStore(this);
    if (zoneId === "cave_interior") {
      // 동굴 내부는 전용 씬
      store.currentZone = "cave_interior";
      store.time.advanceMinutes(ZONE_TRAVEL_MINUTES);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.launch("CaveScene");
        this.scene.pause();
      });
      return;
    }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      store.currentZone = zoneId;
      store.time.advanceMinutes(ZONE_TRAVEL_MINUTES);
      store.pushLog(`${ZONES[zoneId].short}(으)로 이동했다.`);
      this.renderZone();
      this.cameras.main.fadeIn(300, 0, 0, 0);
    });
  }

  private doAction(id: ZoneActionId): void {
    const store = getStore(this);
    const act = ACTIONS[id];

    // 특수 분기
    if (id === "enter_cave") {
      this.travelTo("cave_interior");
      return;
    }
    if (id === "sleep") {
      this.sleep();
      return;
    }
    if (id === "loot_crate") {
      this.lootCrate();
      return;
    }
    if (id === "observe_sea") {
      this.observeSea();
      return;
    }
    if (id === "hunt") {
      this.hunt();
      return;
    }

    // 시간/에너지 소비
    store.time.advanceMinutes(act.costMinutes);
    if (act.costEnergy) store.stats.apply({ energy: -act.costEnergy });

    // 보상 롤
    const yieldStrs: string[] = [];
    for (const r of act.reward) {
      if (r.chance != null && Math.random() > r.chance) continue;
      const n = Phaser.Math.Between(r.min, r.max);
      if (n > 0) {
        store.inv.add(r.id, n);
        yieldStrs.push(`${ITEMS[r.id].icon}${ITEMS[r.id].name} ×${n}`);
      }
    }
    const msg = act.message(yieldStrs.join(", "));
    store.pushLog(msg);
    this.flashHero();

    // 밤 조우 가능성
    if (store.time.phase === "night" && (id === "gather_berry" || id === "gather_wood" || id === "look_around") && Math.random() < 0.2) {
      const mob = Phaser.Utils.Array.GetRandom(NIGHT_MOBS) as EnemyDef;
      this.triggerCombat(mob);
      return;
    }

    this.renderZone();
  }

  private flashHero(): void {
    this.tweens.add({ targets: this.hero, scale: 1.2, duration: 120, yoyo: true });
  }

  private lootCrate(): void {
    const store = getStore(this);
    store.time.advanceMinutes(30);
    store.stats.apply({ energy: -5 });
    const lootPools = [
      [{ id: "can_food" as const, count: 3 }, { id: "bandage" as const, count: 1 }, { id: "water_clean" as const, count: 2 }],
      [{ id: "can_food" as const, count: 2 }, { id: "pistol" as const, count: 1 }, { id: "bullet" as const, count: 6 }],
      [{ id: "blanket" as const, count: 1 }, { id: "cloth" as const, count: 3 }, { id: "water_clean" as const, count: 1 }],
    ];
    const idx = store.flags.lootedCrates;
    const loot = lootPools[idx] ?? lootPools[0];
    for (const l of loot) store.inv.add(l.id, l.count);
    store.flags.lootedCrates += 1;
    const text = loot.map((l) => `${ITEMS[l.id].icon}${ITEMS[l.id].name}×${l.count}`).join(", ");
    store.pushLog(`📦 상자에서 ${text}을(를) 찾았다.`);
    this.renderZone();
  }

  private observeSea(): void {
    const store = getStore(this);
    store.time.advanceMinutes(20);
    const nextBoss = Math.ceil(store.time.day / 10) * 10;
    const left = nextBoss - store.time.day;
    if (left === 0) {
      store.pushLog("🌊 수면이 부자연스럽게 솟구친다… 오늘 무언가 올 것이다.");
    } else if (left <= 2) {
      store.pushLog(`🔭 수평선이 검게 물든다. ${left}일 내에 해양 습격이 있을 것.`);
    } else {
      store.pushLog("🔭 오늘은 바다가 고요하다. 구조선은 아직 없다.");
    }
    this.renderZone();
  }

  private hunt(): void {
    const store = getStore(this);
    store.time.advanceMinutes(40);
    store.stats.apply({ energy: -10 });
    if (Math.random() < 0.5) {
      store.pushLog("🌿 사냥감을 놓쳤다.");
      this.renderZone();
      return;
    }
    const target = Phaser.Utils.Array.GetRandom(DAY_GAME) as EnemyDef;
    this.triggerCombat(target);
  }

  private sleep(): void {
    const store = getStore(this);
    if (store.currentZone !== "camp") {
      store.pushLog("거점에서만 안전하게 잘 수 있다.");
      return;
    }
    const quality = store.flags.hasTent ? "편안하게" : "땅바닥에서";
    // 남은 현재 phase 스킵 → 다음 낮 06:00 까지
    if (store.time.phase === "day") {
      store.time.advanceMinutes(12 * 60 - Math.floor(store.time.phaseProgress * 12 * 60)); // to night
    }
    store.time.advanceMinutes(12 * 60 - Math.floor(store.time.phaseProgress * 12 * 60)); // to next day
    store.stats.restFull();
    if (store.flags.hasTent) store.stats.apply({ hp: 20 });
    store.pushLog(`💤 ${quality} 하룻밤을 보냈다.`);
    this.renderZone();
  }

  // ── 전투 트리거 ──
  private triggerSeaBoss(day: number): void {
    const idx = Math.min(SEA_BOSSES.length - 1, Math.floor(day / 10) - 1);
    const boss = SEA_BOSSES[idx];
    getStore(this).pushLog(`⚠ ${boss.name}이(가) 해안에 나타났다!`);
    this.triggerCombat(boss);
  }

  private triggerCombat(enemy: EnemyDef): void {
    this.scene.launch("CombatScene", { enemy });
    this.scene.pause();
  }

  // ── 패널 토글 ──
  private toggleInventory(): void {
    if (this.inventoryPanel.isOpen) this.inventoryPanel.close();
    else this.inventoryPanel.open(() => this.renderZone());
  }
  private toggleCrafting(): void {
    if (this.craftingPanel.isOpen) this.craftingPanel.close();
    else this.craftingPanel.open();
  }
  private toggleJournal(): void {
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
    this.renderZone();
  }
}

void COLORS;
