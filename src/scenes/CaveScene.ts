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
 * 어두운 돌 타일을 클릭하면 광석을 캔다.
 */
export class CaveScene extends Phaser.Scene {
  private tiles: (Phaser.GameObjects.Rectangle | null)[] = [];
  private tileIcons: (Phaser.GameObjects.Text | null)[] = [];
  private depthText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private gridX = 0;
  private gridY = 0;
  private cols = 5;
  private rows = 5;
  private size = 90;
  private gap = 8;
  private lightRadius = 999;
  private rolled: ItemId[] = [];
  private chestIdx = -1; // 이번 그리드의 보물 상자 타일

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
    this.add.text(GAME_WIDTH / 2, 28, "⛏ 동굴 내부", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "26px",
      color: "#eaf0ff",
    }).setOrigin(0.5);

    this.depthText = this.add.text(GAME_WIDTH / 2, 58, `깊이 ${store.caveDepth}층`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "15px",
      color: "#9fb7ff",
    }).setOrigin(0.5);

    // 깊이별 출현 광석 안내
    this.hintText = this.add.text(GAME_WIDTH / 2, 80, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#f0c040",
      align: "center",
    }).setOrigin(0.5);
    this.updateDepthHint(store.caveDepth);

    // 사용법 안내
    this.add.text(GAME_WIDTH / 2, 100, "💡 어두운 돌 타일을 클릭하면 광석을 캔다!", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#aaccff",
    }).setOrigin(0.5);

    // 횃불 소지 여부
    this.lightRadius = store.inv.has("torch") ? 999 : 1.8;

    if (this.lightRadius < 10) {
      this.add.text(GAME_WIDTH / 2, 116, "⚠ 횃불이 없어 주변이 어둡다! 🔥횃불을 제작하면 시야가 넓어진다.", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "12px",
        color: "#ff9944",
      }).setOrigin(0.5);
    }

    // 그리드 생성
    const gridW = this.cols * this.size + (this.cols - 1) * this.gap;
    const gridH = this.rows * this.size + (this.rows - 1) * this.gap;
    this.gridX = (GAME_WIDTH - gridW) / 2;
    this.gridY = 130;

    this.regenerateGrid();

    // 하단 컨트롤
    drawPanel(this, 0, GAME_HEIGHT - 120, GAME_WIDTH, 120, { fill: 0x060a18, alpha: 0.95 });

    // 범례
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 112, "🟫 돌   ⛓ 철광석   💎 다이아몬드", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#8899bb",
    }).setOrigin(0.5);

    const leaveBtn = makeButton(this, 140, GAME_HEIGHT - 66, {
      label: "⬆ 밖으로 나가기",
      width: 210,
      height: 44,
      fontSize: 14,
      onClick: () => this.leave(),
    });
    const deeperBtn = makeButton(this, 390, GAME_HEIGHT - 66, {
      label: "⬇ 더 깊이 내려가기",
      width: 230,
      height: 44,
      fontSize: 14,
      disabled: !this.canDescend(),
      onClick: () => this.descend(),
    });
    const newChunk = makeButton(this, 650, GAME_HEIGHT - 66, {
      label: "🔄 다른 구역 탐색 (20분)",
      width: 230,
      height: 44,
      fontSize: 13,
      onClick: () => {
        store.time.advanceMinutes(20);
        store.stats.apply({ energy: -4 });
        store.pushLog("다른 구역으로 이동해 새 돌벽을 찾았다.");
        this.regenerateGrid();
      },
    });

    // 우측 정보
    const tier = store.inv.bestPickaxeTier();
    const tierName = tier === 2 ? "철 곡괭이 ⚒" : tier === 1 ? "돌 곡괭이 ⛏" : "없음 ❌";
    this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 100, [
      `곡괭이: ${tierName}`,
      `횃불: ${store.inv.count("torch")}개`,
    ].join("\n"), {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#9fb7ff",
      align: "right",
    }).setOrigin(1, 0);

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    void leaveBtn;
    void deeperBtn;
    void newChunk;
  }

  private updateDepthHint(depth: 1 | 2 | 3): void {
    const hints: Record<number, string> = {
      1: "1층: 주로 돌🪨, 가끔 철광석⛓",
      2: "2층: 돌🪨 + 철광석⛓ 많음, 가끔 다이아💎  (철 곡괭이 필요)",
      3: "3층: 철광석⛓ + 다이아몬드💎  (철 곡괭이 필요)",
    };
    this.hintText.setText(hints[depth] ?? "");
  }

  private regenerateGrid(): void {
    this.tiles.forEach((t) => t?.destroy());
    this.tileIcons.forEach((i) => i?.destroy());
    this.tiles = [];
    this.tileIcons = [];

    const store = getStore(this);
    const depth = store.caveDepth;

    // 깊이별 타일 배경색
    const tileColor  = depth === 1 ? 0x3a2820 : depth === 2 ? 0x2a2a3a : 0x1a1a30;
    const borderColor = depth === 1 ? 0x5a4030 : depth === 2 ? 0x4a5070 : 0x3a3a58;

    // 광물 분포
    const dist: Array<[ItemId, number]> =
      depth === 1
        ? [["stone", 0.70], ["iron_ore", 0.28], ["diamond", 0.02]]
        : depth === 2
        ? [["stone", 0.40], ["iron_ore", 0.50], ["diamond", 0.10]]
        : [["stone", 0.20], ["iron_ore", 0.40], ["diamond", 0.40]];

    // 보물 상자: 25% 확률로 무작위 타일 하나
    this.chestIdx = Math.random() < 0.25 ? Math.floor(Math.random() * this.cols * this.rows) : -1;

    this.rolled = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        const roll = Math.random();
        let acc = 0;
        let picked: ItemId = "stone";
        for (const [id, p] of dist) {
          acc += p;
          if (roll <= acc) { picked = id; break; }
        }
        this.rolled.push(picked);

        const x = this.gridX + c * (this.size + this.gap);
        const y = this.gridY + r * (this.size + this.gap);

        // 광물 종류별 미묘한 색 힌트
        const oreHint = picked === "iron_ore"
          ? Phaser.Display.Color.IntegerToColor(tileColor).brighten(10).color
          : picked === "diamond"
          ? Phaser.Display.Color.IntegerToColor(tileColor).brighten(20).color
          : tileColor;
        const tileBaseColor = idx === this.chestIdx ? 0x3a2a08 : oreHint;
        const tileBorderColor = idx === this.chestIdx ? 0xaa8822 : borderColor;

        const tile = this.add
          .rectangle(x, y, this.size, this.size, tileBaseColor, 1)
          .setOrigin(0, 0)
          .setStrokeStyle(idx === this.chestIdx ? 3 : 2, tileBorderColor);
        tile.setData("idx", idx);
        tile.setData("baseColor", tileBaseColor);
        tile.setInteractive({ useHandCursor: true });

        // 아이콘: 보물 상자는 다른 표시
        const iconText = idx === this.chestIdx ? "📦" : "🟫";
        const icon = this.add
          .text(x + this.size / 2, y + this.size / 2, iconText, { fontSize: "34px" })
          .setOrigin(0.5);

        // 횃불 없으면 시야 제한
        if (this.lightRadius < 10) {
          const dx = c - Math.floor(this.cols / 2);
          const dy = r - Math.floor(this.rows / 2);
          if (Math.sqrt(dx * dx + dy * dy) > this.lightRadius) {
            tile.setAlpha(0.25);
            icon.setAlpha(0.25);
          }
        }

        // 보물 상자 반짝임 효과
        if (idx === this.chestIdx) {
          this.tweens.add({ targets: icon, alpha: 0.5, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        }

        tile.on("pointerover", () => tile.setFillStyle(0x4a5070));
        tile.on("pointerout",  () => tile.setFillStyle(tile.getData("baseColor") as number));
        tile.on("pointerdown", () => this.mineTile(idx, tile, icon));

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
      store.pushLog("⛏ 곡괭이가 없어서 캘 수 없다. 제작 패널에서 돌 곡괭이를 만들어야 한다.");
      return;
    }
    if (depth >= 2 && tier < 2) {
      store.pushLog("⚒ 이 깊이는 철 곡괭이가 필요하다. (나뭇가지×2 + 철광석×3 + 밧줄×1)");
      return;
    }

    const ore = this.rolled[idx];
    if (ore === "diamond" && tier < 2) {
      store.pushLog("💎 다이아몬드는 철 곡괭이(⚒)가 있어야 캘 수 있다.");
      return;
    }

    // 보물 상자 처리
    if (idx === this.chestIdx) {
      this.chestIdx = -1;
      tile.disableInteractive();
      audio.play("pickup");
      icon.setText("✨");
      this.tweens.add({ targets: icon, scale: 1.5, alpha: 0, duration: 600 });
      this.tweens.add({ targets: tile, fillAlpha: 0.1, duration: 400, onComplete: () => icon.setVisible(false) });
      // 보물 상자 전리품
      const chestLoot: Array<[ItemId, number]> =
        depth === 3
          ? [["diamond", 2], ["iron_ore", 3]]
          : depth === 2
          ? [["iron_ore", 4], ["rope", 1]]
          : [["stone", 4], ["vine", 2]];
      for (const [id, cnt] of chestLoot) store.inv.add(id, cnt);
      const lootStr = chestLoot.map(([id, n]) => `${ITEMS[id].icon}×${n}`).join(" + ");
      store.pushLog(`📦 동굴 보물 상자 발견! ${lootStr} 획득!`);
      store.time.advanceMinutes(5);
      return;
    }

    // 채굴 성공
    audio.play("mine");
    store.time.advanceMinutes(10);
    store.stats.apply({ energy: -3 });

    // 채굴 스파크 이펙트
    const sparks = this.add.particles(
      this.gridX + (idx % this.cols) * (this.size + this.gap) + this.size / 2,
      this.gridY + Math.floor(idx / this.cols) * (this.size + this.gap) + this.size / 2,
      "particle",
      {
        speed: { min: 30, max: 80 },
        lifespan: 400,
        quantity: 6,
        scale: { start: 0.5, end: 0 },
        tint: ore === "diamond" ? 0x88ddff : ore === "iron_ore" ? 0xcc8844 : 0xaa9966,
      }
    );
    this.time.delayedCall(500, () => sparks.destroy());

    // 채굴된 광석 아이콘 표시
    icon.setText(ITEMS[ore].icon);
    this.tweens.add({ targets: icon, scale: 0.5, alpha: 0, duration: 300 });
    this.tweens.add({
      targets: tile,
      fillAlpha: 0.15,
      duration: 300,
      onComplete: () => {
        tile.disableInteractive();
        icon.setVisible(false);
      },
    });

    const yieldCount = ore === "stone" ? Phaser.Math.Between(1, 2) : 1;
    store.inv.add(ore, yieldCount);
    store.pushLog(`⛏ ${ITEMS[ore].icon} ${ITEMS[ore].name} ×${yieldCount} 획득!`);
    this.time.delayedCall(150, () => audio.play("pickup"));

    // 깊은 층 조각상 조우 → 전투!
    if (depth >= 2 && Math.random() < 0.07) {
      store.pushLog("🗿 …어둠 속에서 돌 조각상이 움직인다! 피해야 한다!");
      this.time.delayedCall(800, () => {
        this.scene.launch("CombatScene", {
          enemy: {
            id: "cave_statue",
            name: "돌 조각상",
            icon: "🗿",
            hp: 35 + depth * 15,
            atk: 10 + depth * 5,
            canFlee: true,
            loot: [{ id: "stone", count: 3, chance: 1 }],
            flavor: "눈 깜짝할 새 움직인다. 보지 않으면 더 빨라진다.",
            kind: "land",
          }
        });
        this.scene.pause("CaveScene");
      });
    }
  }

  private canDescend(): boolean {
    const store = getStore(this);
    if (store.caveDepth >= 3) return false;
    if (store.caveDepth === 1 && store.inv.bestPickaxeTier() < 1) return false;
    if (store.caveDepth >= 2 && store.inv.bestPickaxeTier() < 2) return false;
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
    this.updateDepthHint(store.caveDepth);
    this.regenerateGrid();
  }

  private leave(): void {
    const store = getStore(this);
    store.caveDepth = 0;
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
