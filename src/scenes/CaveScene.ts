import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import { getStore } from "../systems/GameStore";
import { makeButton } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { audio } from "../systems/AudioManager";
import type { ItemId } from "../types";

/**
 * 동굴 내부 채굴. 5x5 타일. 깊이 1~3층.
 */
export class CaveScene extends Phaser.Scene {
  private tiles: (Phaser.GameObjects.Rectangle | null)[] = [];
  private tileIcons: (Phaser.GameObjects.Text | null)[] = [];
  private depthText!: Phaser.GameObjects.Text;
  private gridX = 0;
  private gridY = 0;
  private cols = 5;
  private rows = 5;
  private size = 90;
  private gap = 8;
  private lightRadius = 999; // 횃불 없으면 1
  private rolled: ItemId[] = [];

  constructor() {
    super("CaveScene");
  }

  create(): void {
    const store = getStore(this);
    const cam = this.cameras.main;
    cam.fadeIn(400, 0, 0, 0);

    audio.playBgm("cave");

    if (store.caveDepth === 0) store.caveDepth = 1;

    // 배경
    const bg = this.add.graphics();
    bg.fillStyle(0x06090f, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const glow = this.add.graphics();
    glow.fillStyle(0x0a1020, 1);
    glow.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 480);

    // 타이틀
    this.add.text(GAME_WIDTH / 2, 40, "⛏ 동굴 내부", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "28px",
      color: "#eaf0ff",
    }).setOrigin(0.5);
    this.depthText = this.add.text(GAME_WIDTH / 2, 72, `깊이 ${store.caveDepth}층`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "16px",
      color: "#9fb7ff",
    }).setOrigin(0.5);

    // 횃불 소지 여부
    this.lightRadius = store.inv.has("torch") ? 999 : 1.8;

    // 그리드 생성
    const gridW = this.cols * this.size + (this.cols - 1) * this.gap;
    const gridH = this.rows * this.size + (this.rows - 1) * this.gap;
    this.gridX = (GAME_WIDTH - gridW) / 2;
    this.gridY = 130;

    this.regenerateGrid();

    // 하단 컨트롤
    drawPanel(this, 0, GAME_HEIGHT - 120, GAME_WIDTH, 120, { fill: 0x060a18, alpha: 0.95 });

    const leaveBtn = makeButton(this, 160, GAME_HEIGHT - 60, {
      label: "⬆ 밖으로 나가기",
      width: 220,
      height: 46,
      fontSize: 14,
      onClick: () => this.leave(),
    });
    const deeperBtn = makeButton(this, 420, GAME_HEIGHT - 60, {
      label: "⬇ 더 깊이 내려가기",
      width: 240,
      height: 46,
      fontSize: 14,
      disabled: !this.canDescend(),
      onClick: () => this.descend(),
    });
    const newChunk = makeButton(this, 680, GAME_HEIGHT - 60, {
      label: "🔄 새 광맥 탐색",
      width: 200,
      height: 46,
      fontSize: 13,
      onClick: () => {
        store.time.advanceMinutes(20);
        store.stats.apply({ energy: -4 });
        store.pushLog("새 광맥을 찾아 이동했다.");
        this.regenerateGrid();
      },
    });

    const info = this.add.text(GAME_WIDTH - 40, GAME_HEIGHT - 72, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#9fb7ff",
      align: "right",
    }).setOrigin(1, 0);
    const tier = store.inv.bestPickaxeTier();
    info.setText(
      `곡괭이: ${tier === 2 ? "철" : tier === 1 ? "돌" : "없음"}\n` +
      `횃불: ${store.inv.count("torch")}개\n` +
      (this.lightRadius < 10 ? "⚠ 어둡다. 주변만 보인다." : "")
    );

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    void leaveBtn;
    void deeperBtn;
    void newChunk;
  }

  private regenerateGrid(): void {
    // 청소
    this.tiles.forEach((t) => t?.destroy());
    this.tileIcons.forEach((i) => i?.destroy());
    this.tiles = [];
    this.tileIcons = [];

    const store = getStore(this);
    const depth = store.caveDepth;

    // 광물 분포 테이블
    const dist: Array<[ItemId, number]> =
      depth === 1
        ? [["stone", 0.7], ["iron_ore", 0.28], ["diamond", 0.02]]
        : depth === 2
        ? [["stone", 0.4], ["iron_ore", 0.5], ["diamond", 0.1]]
        : [["stone", 0.2], ["iron_ore", 0.4], ["diamond", 0.4]];

    this.rolled = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const roll = Math.random();
        let acc = 0;
        let picked: ItemId = "stone";
        for (const [id, p] of dist) {
          acc += p;
          if (roll <= acc) {
            picked = id;
            break;
          }
        }
        this.rolled.push(picked);

        const x = this.gridX + c * (this.size + this.gap);
        const y = this.gridY + r * (this.size + this.gap);
        const tile = this.add.rectangle(x, y, this.size, this.size, 0x1a1f2e, 1).setOrigin(0, 0).setStrokeStyle(2, 0x2a2f40);
        tile.setData("idx", r * this.cols + c);
        tile.setInteractive({ useHandCursor: true });

        const icon = this.add.text(x + this.size / 2, y + this.size / 2, "⬛", { fontSize: "36px" }).setOrigin(0.5);

        // 어둠 처리
        if (this.lightRadius < 10) {
          const dx = c - Math.floor(this.cols / 2);
          const dy = r - Math.floor(this.rows / 2);
          const dist2 = Math.sqrt(dx * dx + dy * dy);
          if (dist2 > this.lightRadius) {
            tile.setAlpha(0.3);
            icon.setAlpha(0.3);
          }
        }

        tile.on("pointerover", () => tile.setFillStyle(0x263050));
        tile.on("pointerout", () => tile.setFillStyle(0x1a1f2e));
        tile.on("pointerdown", () => this.mineTile(r * this.cols + c, tile, icon));

        this.tiles.push(tile);
        this.tileIcons.push(icon);
      }
    }
  }

  private mineTile(idx: number, tile: Phaser.GameObjects.Rectangle, icon: Phaser.GameObjects.Text): void {
    const store = getStore(this);
    if (!tile.input) return;
    const tier = store.inv.bestPickaxeTier();
    const depth = store.caveDepth;
    if (tier < 1) {
      store.pushLog("⛏ 곡괭이가 없다.");
      return;
    }
    if (depth >= 2 && tier < 2) {
      store.pushLog("⛏ 더 단단한 곡괭이(철 곡괭이)가 필요하다.");
      return;
    }

    const ore = this.rolled[idx];
    if (ore === "iron_ore" && tier < 1) return;
    if (ore === "diamond" && tier < 2) {
      store.pushLog("다이아몬드는 철 곡괭이가 필요하다.");
      return;
    }

    // 채굴
    audio.play("mine");
    store.time.advanceMinutes(10);
    store.stats.apply({ energy: -3 });
    this.tweens.add({ targets: icon, scale: 0.5, alpha: 0, duration: 250 });
    this.tweens.add({
      targets: tile,
      fillAlpha: 0.2,
      duration: 250,
      onComplete: () => {
        tile.disableInteractive();
        icon.setVisible(false);
      },
    });
    const yieldCount = ore === "stone" ? Phaser.Math.Between(1, 2) : 1;
    store.inv.add(ore, yieldCount);
    store.pushLog(`⛏ ${ITEMS[ore].icon} ${ITEMS[ore].name} ×${yieldCount} 획득.`);
    this.time.delayedCall(140, () => audio.play("pickup"));

    // 조각상 조우 확률 (밤/깊이)
    if (depth >= 2 && Math.random() < 0.08) {
      store.pushLog("어둠 속에서 돌 조각상이 움직인다…");
      // 추후 전투 트리거 가능 (생략 가능)
    }
  }

  private canDescend(): boolean {
    const store = getStore(this);
    if (store.caveDepth >= 3) return false;
    if (store.caveDepth === 1 && store.inv.bestPickaxeTier() < 1) return false;
    if (store.caveDepth === 2 && store.inv.bestPickaxeTier() < 2) return false;
    return true;
  }

  private descend(): void {
    const store = getStore(this);
    if (!this.canDescend()) return;
    const next = Math.min(3, store.caveDepth + 1) as 1 | 2 | 3;
    store.caveDepth = next;
    store.time.advanceMinutes(20);
    store.stats.apply({ energy: -8 });
    store.pushLog(`⬇ ${store.caveDepth}층으로 내려왔다.`);
    this.depthText.setText(`깊이 ${store.caveDepth}층`);
    this.regenerateGrid();
  }

  private leave(): void {
    const store = getStore(this);
    store.caveDepth = 0;
    store.currentZone = "cave_entrance";
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      this.scene.stop();
      this.scene.resume("WorldScene");
      const world = this.scene.get("WorldScene") as import("./WorldScene").WorldScene;
      (world.resumeFromOverlay as () => void).call(world);
      this.scene.get("WorldScene").cameras.main.fadeIn(300, 0, 0, 0);
    });
  }

  shutdown(): void {
    void COLORS;
  }
}
