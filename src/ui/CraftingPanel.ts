import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import { drawPanel } from "./Panel";
import { makeButton } from "./Button";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";
import type { Recipe } from "../types";

export class CraftingPanel {
  private container?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {}

  open(): void {
    if (this.container) this.close();
    const store = getStore(this.scene);
    const w = 880;
    const h = 600;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const c = this.scene.add.container(0, 0).setDepth(200);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    overlay.setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });
    const title = this.scene.add.text(x + 20, y + 18, "🔨 제작", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "24px",
      color: "#eaf0ff",
    });
    const hint = this.scene.add.text(x + 20, y + 52, "재료가 충분한 레시피를 클릭하면 제작된다.", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#8d9bd1",
    });
    c.add([overlay, panel, title, hint]);

    const recipes: Recipe[] = store.crafting.listRecipes();
    const cardW = 260;
    const cardH = 110;
    const cols = 3;
    const gap = 12;
    const startX = x + 30;
    const startY = y + 90;

    recipes.forEach((recipe, idx) => {
      const cx = startX + (idx % cols) * (cardW + gap);
      const cy = startY + Math.floor(idx / cols) * (cardH + gap);
      const can = store.crafting.canCraft(recipe);

      const bg = this.scene.add.rectangle(cx, cy, cardW, cardH, 0x101a38, 1).setOrigin(0, 0).setStrokeStyle(2, can.ok ? COLORS.accent : COLORS.panelBorder);
      const icon = this.scene.add.text(cx + 14, cy + 10, recipe.icon, { fontSize: "42px" });
      const nm = this.scene.add.text(cx + 72, cy + 10, recipe.name, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "18px",
        color: "#eaf0ff",
      });
      const inputs = recipe.inputs
        .map((r) => `${ITEMS[r.id].icon}${ITEMS[r.id].name} ${store.inv.count(r.id)}/${r.count}`)
        .join("\n");
      const inp = this.scene.add.text(cx + 72, cy + 38, inputs, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "12px",
        color: can.ok ? "#cfd8ff" : "#7a8bc4",
      });
      let status = can.ok ? "제작 가능" : can.reason ?? "재료 부족";
      if (recipe.requires?.length) {
        status += recipe.requires.includes("bonfire") ? " · 🏕모닥불" : "";
        status += recipe.requires.includes("tent") ? " · ⛺천막" : "";
      }
      const st = this.scene.add.text(cx + 14, cy + cardH - 18, status, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "11px",
        color: can.ok ? "#8be58b" : "#ff9a9a",
      });
      c.add([bg, icon, nm, inp, st]);

      bg.setInteractive({ useHandCursor: can.ok });
      bg.on("pointerover", () => {
        if (can.ok) bg.setFillStyle(0x1c2a5c);
      });
      bg.on("pointerout", () => bg.setFillStyle(0x101a38));
      bg.on("pointerdown", () => {
        if (!can.ok) {
          store.pushLog("제작 조건이 부족하다.");
          audio.play("error");
          return;
        }
        if (store.crafting.craft(recipe)) {
          store.pushLog(`🔨 ${recipe.name}을(를) 제작했다.`);
          audio.play("craft");
          this.close();
          this.open();
        }
      });
    });

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

    const worldCam = this.scene.cameras.main;
    if (worldCam) worldCam.ignore(c);
  }

  close(): void {
    this.container?.destroy();
    this.container = undefined;
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
