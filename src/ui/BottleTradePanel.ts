import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import type { ItemId } from "../types";
import { drawPanel } from "./Panel";
import { makeButton } from "./Button";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";

/** 유리병 무역 가능한 재료 목록. 희귀도별로 돌아오는 보상이 다르다. */
export const BOTTLE_TRADE_ITEMS: ItemId[] = [
  "stick", "stone", "vine", "cloth", "rope", "berry", "mushroom",
  "metal_scrap", "iron_ore", "diamond", "bandage", "herbal_drink",
  "bullet", "seed",
];

export class BottleTradePanel {
  private container?: Phaser.GameObjects.Container;
  constructor(private scene: Phaser.Scene) {}

  open(): void {
    if (this.container) this.close();
    const store = getStore(this.scene);

    // 보낼 수 있는 아이템만 필터
    const available = BOTTLE_TRADE_ITEMS.filter((id) => store.inv.count(id) > 0);

    const w = 640;
    const h = available.length === 0 ? 220 : 520;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const c = this.scene.add.container(0, 0).setDepth(220);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setOrigin(0, 0).setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });

    const title = this.scene.add.text(x + 22, y + 18, "🫙 유리병 무역", {
      fontFamily: "Galmuri11, monospace", fontSize: "24px", color: "#eaf0ff",
    });
    const hint = this.scene.add.text(x + 22, y + 50,
      available.length === 0
        ? "담을 수 있는 재료가 없다. 일반 재료·광물·회복품을 가져오자."
        : "담아 보낼 재료를 하나 고르면, 2~3일 뒤 더 귀한 것이 돌아올지도 모른다.",
      {
        fontFamily: "Galmuri11, monospace", fontSize: "13px",
        color: "#9fb7ff", wordWrap: { width: w - 60 },
      }
    );

    c.add([overlay, panel, title, hint]);

    if (store.flags.sentBottle) {
      const sentDef = ITEMS[store.flags.sentBottle.itemId];
      const daysAgo = store.time.day - store.flags.sentBottle.sentDay;
      const warn = this.scene.add.text(x + 22, y + 82,
        `⚠ 이미 ${sentDef.icon}${sentDef.name}이(가) 담긴 병을 ${daysAgo}일 전 띄웠다. 돌아오기 전에 또 띄우면 덮어쓴다.`,
        { fontFamily: "Galmuri11, monospace", fontSize: "12px", color: "#ffcc44", wordWrap: { width: w - 60 } }
      );
      c.add(warn);
    }

    const closeX = makeButton(this.scene, x + w - 40, y + 36, {
      label: "✕",
      width: 60, height: 48, fontSize: 24,
      bg: 0x2a0f18, hover: 0x4a1520, border: 0x8a2230,
      onClick: () => this.close(),
    });
    c.add(closeX);

    // 아이템 그리드
    if (available.length > 0) {
      const cols = 4;
      const cardW = 140;
      const cardH = 90;
      const gap = 10;
      const startX = x + (w - cols * cardW - (cols - 1) * gap) / 2;
      const startY = y + 120;

      available.forEach((id, i) => {
        const cx = startX + (i % cols) * (cardW + gap);
        const cy = startY + Math.floor(i / cols) * (cardH + gap);
        const def = ITEMS[id];
        const have = store.inv.count(id);

        const bg = this.scene.add
          .rectangle(cx, cy, cardW, cardH, 0x101a38, 1)
          .setOrigin(0, 0)
          .setStrokeStyle(2, COLORS.panelBorder);
        const icon = this.scene.add.text(cx + cardW / 2, cy + 26, def.icon, { fontSize: "28px" }).setOrigin(0.5);
        const name = this.scene.add.text(cx + cardW / 2, cy + 56, def.name, {
          fontFamily: "Galmuri11, monospace", fontSize: "12px", color: "#eaf0ff",
        }).setOrigin(0.5);
        const cnt = this.scene.add.text(cx + cardW / 2, cy + 72, `보유 ${have}`, {
          fontFamily: "Galmuri11, monospace", fontSize: "11px", color: "#8d9bd1",
        }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x1a2a5e));
        bg.on("pointerout", () => bg.setFillStyle(0x101a38));
        bg.on("pointerdown", () => this.sendBottle(id));

        c.add([bg, icon, name, cnt]);
      });
    }

    this.scene.input.keyboard?.once("keydown-ESC", () => this.close());

    const worldCam = this.scene.cameras.main;
    if (worldCam) worldCam.ignore(c);
    this.container = c;
  }

  private sendBottle(id: ItemId): void {
    const store = getStore(this.scene);
    if (!store.inv.has("glass_bottle")) {
      store.pushLog("🫙 유리병이 없다.");
      this.close();
      return;
    }
    if (!store.inv.has(id)) {
      store.pushLog("보낼 재료가 없다.");
      return;
    }
    store.inv.remove("glass_bottle", 1);
    store.inv.remove(id, 1);
    store.flags.sentBottle = { itemId: id, sentDay: store.time.day };
    const def = ITEMS[id];
    store.pushLog(`🫙 ${def.icon}${def.name}을(를) 담은 유리병을 바다에 띄웠다. 2~3일 뒤 돌아올 것.`);
    audio.play("pickup");
    this.close();
  }

  close(): void {
    this.container?.destroy();
    this.container = undefined;
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
