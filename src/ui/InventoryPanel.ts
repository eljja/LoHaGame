import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import type { ItemId } from "../types";
import { drawPanel } from "./Panel";
import { makeButton } from "./Button";
import { getStore } from "../systems/GameStore";

export class InventoryPanel {
  private container?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {}

  open(onUse?: (id: ItemId) => void): void {
    if (this.container) this.close();
    const store = getStore(this.scene);
    const w = 720;
    const h = 540;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const c = this.scene.add.container(0, 0).setDepth(200);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    overlay.setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });
    const title = this.scene.add.text(x + 20, y + 18, "🎒 인벤토리", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "24px",
      color: "#eaf0ff",
    });
    const hint = this.scene.add.text(x + 20, y + 52, "아이템을 클릭하면 사용할 수 있다.", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#8d9bd1",
    });

    c.add([overlay, panel, title, hint]);

    // 슬롯 그리드 4열 x 5행
    const cols = 5;
    const rows = 4;
    const slotSize = 96;
    const gap = 12;
    const gridW = cols * slotSize + (cols - 1) * gap;
    const startX = x + (w - gridW) / 2;
    const startY = y + 90;

    for (let i = 0; i < cols * rows; i++) {
      const cx = startX + (i % cols) * (slotSize + gap);
      const cy = startY + Math.floor(i / cols) * (slotSize + gap);
      const slot = store.inv.slots[i] ?? null;

      const bg = this.scene.add.rectangle(cx, cy, slotSize, slotSize, 0x111a38, 1).setOrigin(0, 0).setStrokeStyle(2, COLORS.panelBorder);
      c.add(bg);
      if (slot) {
        const def = ITEMS[slot.id];
        const emoji = this.scene.add.text(cx + slotSize / 2, cy + slotSize / 2 - 6, def.icon, {
          fontSize: "42px",
        }).setOrigin(0.5);
        const name = this.scene.add.text(cx + slotSize / 2, cy + slotSize - 20, def.name, {
          fontFamily: "Galmuri11, monospace",
          fontSize: "11px",
          color: "#cfd8ff",
        }).setOrigin(0.5);
        const count = this.scene.add.text(cx + slotSize - 6, cy + 4, String(slot.count), {
          fontFamily: "Galmuri11, monospace",
          fontSize: "13px",
          color: "#ffd97a",
        }).setOrigin(1, 0);
        c.add([emoji, name, count]);
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x1c2a5c));
        bg.on("pointerout", () => bg.setFillStyle(0x111a38));
        bg.on("pointerdown", () => {
          this.useItem(slot.id, onUse);
        });
      }
    }

    // 닫기: 우상단 ✕ 큰 버튼 (터치 친화)
    const closeX = makeButton(this.scene, x + w - 40, y + 40, {
      label: "✕",
      width: 60,
      height: 56,
      fontSize: 28,
      bg: 0x2a0f18,
      hover: 0x4a1520,
      border: 0x8a2230,
      onClick: () => this.close(),
    });
    c.add(closeX);

    this.scene.input.keyboard?.once("keydown-ESC", () => this.close());
    this.container = c;
  }

  private useItem(id: ItemId, onUse?: (id: ItemId) => void): void {
    const store = getStore(this.scene);
    const def = ITEMS[id];
    if (def.placeable) {
      // Allow placement on grass or sand terrain (open world)
      const map = store.map;
      const terrain = map.terrainAt(store.playerTx, store.playerTy);
      if (terrain !== "grass" && terrain !== "sand" && terrain !== "forest") {
        store.pushLog("이곳에는 설치할 수 없다. 풀밭이나 해변에서만 설치할 수 있다.");
        return;
      }
      if (def.placeable === "bonfire" && !store.flags.hasBonfire) {
        store.inv.remove(id, 1);
        store.flags.hasBonfire = true;
        store.pushLog("🔥 모닥불을 피웠다. 요리가 가능하다.");
      } else if (def.placeable === "tent" && !store.flags.hasTent) {
        store.inv.remove(id, 1);
        store.flags.hasTent = true;
        store.pushLog("⛺ 천막을 세웠다. 거점이 확장됐다.");
      } else {
        store.pushLog("이미 설치되어 있다.");
      }
      this.close();
      if (onUse) onUse(id);
      return;
    }
    if (def.consume) {
      store.inv.remove(id, 1);
      store.stats.apply(def.consume);
      store.pushLog(`${def.icon} ${def.name}을(를) 사용했다.`);
      this.close();
      if (onUse) onUse(id);
      return;
    }
    store.pushLog(`${def.name}은(는) 지금 사용할 수 없다.`);
  }

  close(): void {
    this.container?.destroy();
    this.container = undefined;
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
