import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import type { ItemId } from "../types";
import { drawPanel } from "./Panel";
import { makeButton, type ButtonNode } from "./Button";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";

export class InventoryPanel {
  private container?: Phaser.GameObjects.Container;
  private selectedSlotIdx: number | null = null;
  private detailContainer?: Phaser.GameObjects.Container;
  private gridContainer?: Phaser.GameObjects.Container;
  private onUseCallback?: (id: ItemId) => void;

  constructor(private scene: Phaser.Scene) {}

  open(onUse?: (id: ItemId) => void): void {
    if (this.container) this.close();
    this.onUseCallback = onUse;
    this.selectedSlotIdx = null;
    const w = 780;
    const h = 620;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const c = this.scene.add.container(0, 0).setDepth(200);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0);
    overlay.setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });
    const title = this.scene.add.text(x + 22, y + 20, "🎒 인벤토리", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "24px",
      color: "#eaf0ff",
    });
    const hint = this.scene.add.text(x + 22, y + 54, "슬롯을 클릭하면 아이템 정보와 사용 옵션이 표시된다.", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#8d9bd1",
    });
    c.add([overlay, panel, title, hint]);

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

    this.container = c;

    const gridSlot = this.scene.add.container(0, 0);
    this.gridContainer = gridSlot;
    c.add(gridSlot);
    this.renderGrid(x, y, w);

    const detailSlot = this.scene.add.container(0, 0);
    this.detailContainer = detailSlot;
    c.add(detailSlot);
    this.renderDetail(x, y, w, h);

    this.scene.input.keyboard?.once("keydown-ESC", () => this.close());

    const worldCam = this.scene.cameras.main;
    if (worldCam) worldCam.ignore(c);
  }

  private renderGrid(panelX: number, panelY: number, panelW: number): void {
    const slot = this.gridContainer!;
    slot.removeAll(true);
    const store = getStore(this.scene);

    const cols = 5;
    const slotSize = 74;
    const gap = 8;
    const gridW = cols * slotSize + (cols - 1) * gap;
    const startX = panelX + (panelW - gridW) / 2;
    const startY = panelY + 84;

    for (let i = 0; i < 20; i++) {
      const cx = startX + (i % cols) * (slotSize + gap);
      const cy = startY + Math.floor(i / cols) * (slotSize + gap);
      const item = store.inv.slots[i] ?? null;
      const isSelected = this.selectedSlotIdx === i;

      const borderCol = isSelected ? COLORS.accent : COLORS.panelBorder;
      const fillCol = isSelected ? 0x1c2a5c : 0x111a38;
      const bg = this.scene.add
        .rectangle(cx, cy, slotSize, slotSize, fillCol, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(isSelected ? 3 : 2, borderCol);
      slot.add(bg);

      if (item) {
        const def = ITEMS[item.id];
        const emoji = this.scene.add
          .text(cx + slotSize / 2, cy + slotSize / 2 - 6, def.icon, { fontSize: "30px" })
          .setOrigin(0.5);
        const count = this.scene.add
          .text(cx + slotSize - 4, cy + 2, `×${item.count}`, {
            fontFamily: "Galmuri11, monospace",
            fontSize: "11px",
            color: "#ffd97a",
          })
          .setOrigin(1, 0);
        const catColors: Record<string, string> = {
          food: "#8be58b", weapon: "#ff9a9a", tool: "#ffd97a", material: "#a3b4e8", misc: "#cfd8ff", build: "#e8c860",
        };
        const cat = this.scene.add
          .text(cx + slotSize / 2, cy + slotSize - 11, def.name, {
            fontFamily: "Galmuri11, monospace",
            fontSize: "10px",
            color: catColors[def.category] ?? "#cfd8ff",
          })
          .setOrigin(0.5);
        slot.add([emoji, count, cat]);

        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => { if (!isSelected) bg.setFillStyle(0x172447); });
        bg.on("pointerout", () => { if (!isSelected) bg.setFillStyle(fillCol); });
        bg.on("pointerdown", () => {
          if (this.selectedSlotIdx === i) {
            this.selectedSlotIdx = null;
          } else {
            this.selectedSlotIdx = i;
            audio.play("click");
          }
          const w = 780;
          const h = 620;
          const x = (GAME_WIDTH - w) / 2;
          const y = (GAME_HEIGHT - h) / 2;
          this.renderGrid(x, y, w);
          this.renderDetail(x, y, w, h);
        });
      } else {
        // 빈 슬롯: 슬롯 번호 표시
        const numTxt = this.scene.add.text(cx + slotSize / 2, cy + slotSize / 2, String(i + 1), {
          fontFamily: "Galmuri11, monospace",
          fontSize: "14px",
          color: "#2a3660",
        }).setOrigin(0.5);
        slot.add(numTxt);
      }
    }

    const worldCam = this.scene.cameras.main;
    if (worldCam && this.container) worldCam.ignore(slot);
  }

  private renderDetail(panelX: number, panelY: number, panelW: number, panelH: number): void {
    const slot = this.detailContainer!;
    slot.removeAll(true);
    const store = getStore(this.scene);

    // 그리드: startY=panelY+84, 4행 × (slotSize 74 + gap 8 = 82), 트레일링 gap 제거
    const gridBottomOffset = 84 + 4 * 82 - 8; // 404
    const detailY = panelY + gridBottomOffset + 14;
    const detailH = panelH - (detailY - panelY) - 20;
    const dX = panelX + 16;
    const dW = panelW - 32;

    // 구분선
    const sep = this.scene.add
      .rectangle(dX, detailY, dW, 1, COLORS.panelBorder, 0.5)
      .setOrigin(0, 0);
    slot.add(sep);

    if (this.selectedSlotIdx === null || !store.inv.slots[this.selectedSlotIdx]) {
      const hintText = this.scene.add
        .text(panelX + panelW / 2, detailY + detailH / 2, "슬롯을 클릭하면 아이템 정보가 표시됩니다.", {
          fontFamily: "Galmuri11, monospace",
          fontSize: "13px",
          color: "#4a5880",
        })
        .setOrigin(0.5);
      slot.add(hintText);
      const worldCam = this.scene.cameras.main;
      if (worldCam && this.container) worldCam.ignore(slot);
      return;
    }

    const item = store.inv.slots[this.selectedSlotIdx]!;
    const def = ITEMS[item.id];

    // 아이콘 + 이름
    const iconTxt = this.scene.add
      .text(dX + 40, detailY + 16, def.icon, { fontSize: "44px" })
      .setOrigin(0.5, 0);
    const nameTxt = this.scene.add
      .text(dX + 76, detailY + 16, def.name, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "20px",
        color: "#eaf0ff",
      });
    const catColors: Record<string, string> = {
      food: "#8be58b", weapon: "#ff9a9a", tool: "#ffd97a", material: "#a3b4e8", misc: "#cfd8ff", build: "#e8c860",
    };
    const catLabel: Record<string, string> = {
      food: "음식", weapon: "무기", tool: "도구", material: "재료", misc: "기타", build: "건축",
    };
    const catTxt = this.scene.add.text(dX + 76, detailY + 44, `[${catLabel[def.category] ?? def.category}]  보유: ${item.count}개`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: catColors[def.category] ?? "#a3b4e8",
    });
    const descTxt = this.scene.add.text(dX + 76, detailY + 64, def.desc, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#8d9bd1",
      wordWrap: { width: dW - 90 },
    });
    slot.add([iconTxt, nameTxt, catTxt, descTxt]);

    // 스탯 효과 표시 (소비 아이템)
    if (def.consume) {
      const parts: string[] = [];
      const c = def.consume;
      if (c.hp)     parts.push(`❤ HP ${c.hp > 0 ? "+" : ""}${c.hp}`);
      if (c.hunger) parts.push(`🍗 허기 ${c.hunger > 0 ? "+" : ""}${c.hunger}`);
      if (c.thirst) parts.push(`💧 갈증 ${c.thirst > 0 ? "+" : ""}${c.thirst}`);
      if (c.energy) parts.push(`⚡ 행동력 ${c.energy > 0 ? "+" : ""}${c.energy}`);
      const effectTxt = this.scene.add.text(dX + 76, detailY + 88, parts.join("   "), {
        fontFamily: "Galmuri11, monospace",
        fontSize: "13px",
        color: "#ffe08a",
      });
      slot.add(effectTxt);
    }
    if (def.weaponDamage) {
      const dmgTxt = this.scene.add.text(dX + 76, detailY + 88, `⚔ 공격력: ${def.weaponDamage}`, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "13px",
        color: "#ff9a9a",
      });
      slot.add(dmgTxt);
    }

    // 액션 버튼들
    const btnY = detailY + detailH - 4;
    const buttons: Array<{ label: string; action: () => void; disabled?: boolean; color?: number }> = [];

    if (def.consume || def.placeable || def.onUse) {
      const label = def.placeable ? "🏕 설치"
        : def.onUse === "treasure_map" ? "🗺 펼치기"
        : "✅ 사용";
      buttons.push({
        label,
        action: () => this.useItem(item.id),
        color: 0x1e4a2a,
      });
    }
    buttons.push({
      label: "❌ 버리기",
      action: () => this.dropItem(item.id),
      color: 0x2a0f18,
    });

    const bw = 150;
    const gap = 10;
    buttons.forEach((b, i) => {
      const btn = makeButton(this.scene, dX + bw / 2 + i * (bw + gap), btnY, {
        label: b.label,
        width: bw,
        height: 40,
        fontSize: 14,
        bg: b.color ?? COLORS.panel,
        onClick: b.action,
        disabled: b.disabled,
      });
      slot.add(btn as ButtonNode);
    });

    const worldCam = this.scene.cameras.main;
    if (worldCam && this.container) worldCam.ignore(slot);
  }

  private useItem(id: ItemId): void {
    const store = getStore(this.scene);
    const def = ITEMS[id];
    if (def.onUse === "treasure_map") {
      store.inv.remove(id, 1);
      audio.play("menu");
      this.close();
      if (this.onUseCallback) this.onUseCallback(id);
      return;
    }
    if (def.placeable) {
      const map = store.map;
      const tx = store.playerTx;
      const ty = store.playerTy;
      const terrain = map.terrainAt(tx, ty);
      if (terrain !== "grass" && terrain !== "sand" && terrain !== "forest") {
        store.pushLog("이곳에는 설치할 수 없다. 풀밭/해변/숲에서만 설치 가능.");
        return;
      }
      // 현재 타일에 이미 설치물이 있는지 확인
      const existing = map.entityAt(tx, ty);
      if (existing && (existing.type === "bonfire_placed" || existing.type === "tent_placed")) {
        store.pushLog("이 타일에는 이미 구조물이 있다. 한 칸 옆으로 이동해 설치하자.");
        return;
      }
      // camp_spot 위에 설치하면 camp_spot은 대체된다
      if (existing && existing.type === "camp_spot") {
        map.removeEntity(existing.id);
      }

      const placedType: "bonfire_placed" | "tent_placed" =
        def.placeable === "bonfire" ? "bonfire_placed" : "tent_placed";
      let maxId = 0;
      for (const e of map.entities) if (e.id > maxId) maxId = e.id;
      map.entities.push({ id: maxId + 1, type: placedType, tx, ty });
      store.inv.remove(id, 1);

      if (def.placeable === "bonfire") {
        store.flags.hasBonfire = true;
        store.pushLog("🔥 이 자리에 모닥불을 피웠다! 주변 2칸 이내에서 요리가 가능하다.");
      } else {
        store.flags.hasTent = true;
        store.pushLog("⛺ 이 자리에 천막을 세웠다! 주변 2칸 이내는 밤에도 밝고 몹이 접근하지 않는다.");
      }
      audio.play("craft");
      this.close();
      if (this.onUseCallback) this.onUseCallback(id);
      return;
    }
    if (def.consume) {
      store.inv.remove(id, 1);
      store.stats.apply(def.consume);
      const effects: string[] = [];
      if (def.consume.hp)     effects.push(`❤${def.consume.hp > 0 ? "+" : ""}${def.consume.hp}`);
      if (def.consume.hunger) effects.push(`🍗+${def.consume.hunger}`);
      if (def.consume.thirst) effects.push(`💧+${def.consume.thirst}`);
      if (def.consume.energy) effects.push(`⚡+${def.consume.energy}`);
      store.pushLog(`${def.icon} ${def.name} 사용. ${effects.join(" ")}`);
      audio.play("heal");
      this.selectedSlotIdx = null;
      const w = 780;
      const h = 620;
      const x = (GAME_WIDTH - w) / 2;
      const y = (GAME_HEIGHT - h) / 2;
      this.renderGrid(x, y, w);
      this.renderDetail(x, y, w, h);
      if (this.onUseCallback) this.onUseCallback(id);
      return;
    }
    store.pushLog(`${def.name}은(는) 지금 바로 사용할 수 없다.`);
  }

  private dropItem(id: ItemId): void {
    const store = getStore(this.scene);
    const def = ITEMS[id];
    store.inv.remove(id, 1);
    store.pushLog(`🗑 ${def.icon} ${def.name}을(를) 버렸다.`);
    audio.play("click");
    this.selectedSlotIdx = null;
    const w = 760;
    const h = 570;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    this.renderGrid(x, y, w);
    this.renderDetail(x, y, w, h);
  }

  close(): void {
    this.container?.destroy();
    this.container = undefined;
    this.selectedSlotIdx = null;
    this.detailContainer = undefined;
    this.gridContainer = undefined;
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
