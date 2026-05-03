import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import type { ItemId } from "../types";
import { drawPanel } from "./Panel";
import { makeButton, type ButtonNode } from "./Button";
import { getStore } from "../systems/GameStore";
import { INVENTORY_SLOTS } from "../systems/Inventory";
import { audio } from "../systems/AudioManager";

export class InventoryPanel {
  private container?: Phaser.GameObjects.Container;
  private selectedSlotIdx: number | null = null;
  private detailContainer?: Phaser.GameObjects.Container;
  private gridContainer?: Phaser.GameObjects.Container;
  private onUseCallback?: (id: ItemId) => void;
  private gridScrollY = 0;

  constructor(private scene: Phaser.Scene) {}

  open(onUse?: (id: ItemId) => void): void {
    if (this.container) this.close();
    // 패널이 HUDScene(상단 바·로그) 위에 그려지도록 WorldScene을 최상단으로 이동
    this.scene.scene.bringToTop();
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

    // 그리드 영역 스크롤 마스크 (4행 높이만 표시, 6행 = 30슬롯)
    const cols = 5;
    const slotSize = 74;
    const gap = 8;
    const visibleRows = 4;
    const totalRows = Math.ceil(INVENTORY_SLOTS / cols);
    const gridTop = y + 84;
    const visibleH = visibleRows * slotSize + (visibleRows - 1) * gap;
    const totalH = totalRows * slotSize + (totalRows - 1) * gap;
    const maxScrollY = Math.max(0, totalH - visibleH);

    const maskGfx = this.scene.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(x + 8, gridTop, w - 16, visibleH + 4);
    gridSlot.setMask(maskGfx.createGeometryMask());

    this.gridScrollY = 0;
    this.renderGrid(x, y, w);

    // 휠 스크롤 (그리드 위에서만)
    const wheelHandler = (_p: unknown, _gs: unknown, _dx: number, dy: number) => {
      if (maxScrollY <= 0) return;
      this.gridScrollY = Phaser.Math.Clamp(this.gridScrollY + dy * 0.4, 0, maxScrollY);
      gridSlot.setY(-this.gridScrollY);
    };
    this.scene.input.on("wheel", wheelHandler);
    (c as any)._wheelHandler = wheelHandler;

    // 스크롤 힌트 (스크롤 가능할 때만)
    if (maxScrollY > 0) {
      const hint = this.scene.add.text(x + w - 22, gridTop + visibleH + 6, "↓ 휠 스크롤", {
        fontFamily: "Galmuri11, monospace", fontSize: "11px", color: "#445588",
      }).setOrigin(1, 0);
      c.add(hint);
    }

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

    for (let i = 0; i < INVENTORY_SLOTS; i++) {
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

    // 재렌더 시 스크롤 위치 유지
    slot.setY(-this.gridScrollY);

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

    // 내구도 표시 (무기·도구)
    if (def.maxDurability != null) {
      const cur = item.dur ?? def.maxDurability;
      const pct = cur / def.maxDurability;
      const barX = dX + 76;
      const barY = detailY + 110;
      const barW = 220;
      const barH = 10;
      const color = pct > 0.5 ? 0x6adc4a : pct > 0.25 ? 0xffcc44 : 0xff5a6a;
      const durBg = this.scene.add.rectangle(barX, barY, barW, barH, 0x1a2040, 1)
        .setOrigin(0, 0).setStrokeStyle(1, 0x4a5a8a);
      const durFill = this.scene.add.rectangle(barX, barY, barW * pct, barH, color, 1).setOrigin(0, 0);
      const durTxt = this.scene.add.text(barX + barW + 10, barY - 2, `내구도 ${cur}/${def.maxDurability}`, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "12px",
        color: pct > 0.25 ? "#a3b4e8" : "#ff9a9a",
      });
      slot.add([durBg, durFill, durTxt]);
    }

    // 액션 버튼들
    const btnY = detailY + detailH - 4;
    const buttons: Array<{ label: string; action: () => void; disabled?: boolean; color?: number }> = [];

    if (def.consume || def.placeable || def.onUse) {
      const label =
        def.placeable === "seed" ? "🌱 심기"
        : def.placeable === "signal_fire" ? "🗼 봉화 세우기"
        : def.placeable === "raft" ? "⛵ 뗏목 띄우기"
        : def.placeable ? "🏕 설치"
        : def.onUse === "treasure_map" ? "🗺 펼치기"
        : def.onUse === "bottle_trade" ? "🫙 재료 담기"
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
    if (def.onUse === "bottle_trade") {
      // 유리병은 트레이드 패널에서 "보내기" 버튼으로 실제 소비된다.
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

      // 지형 체크 (설치물별로 다름)
      if (def.placeable === "signal_fire") {
        if (terrain !== "cliff_rock") {
          store.pushLog("🗼 봉화대는 절벽(cliff) 지형에만 설치할 수 있다.");
          return;
        }
      } else if (def.placeable === "seed") {
        if (terrain !== "grass") {
          store.pushLog("🌱 씨앗은 풀밭에만 심을 수 있다.");
          return;
        }
      } else if (def.placeable === "raft") {
        if (terrain !== "sand") {
          store.pushLog("⛵ 뗏목은 해변(sand)에만 띄울 수 있다.");
          return;
        }
      } else {
        if (terrain !== "grass" && terrain !== "sand" && terrain !== "forest") {
          store.pushLog("이곳에는 설치할 수 없다. 풀밭/해변/숲에서만 설치 가능.");
          return;
        }
      }

      // 현재 타일에 이미 설치물이 있는지 확인
      const existing = map.entityAt(tx, ty);
      const blocking = existing && (
        existing.type === "bonfire_placed" || existing.type === "tent_placed" ||
        existing.type === "signal_fire_unlit" || existing.type === "signal_fire_lit" ||
        existing.type === "planted_seed" || existing.type === "ripe_plant" ||
        existing.type === "raft_placed"
      );
      if (blocking) {
        store.pushLog("이 타일에는 이미 무언가 있다. 한 칸 옆으로 이동해 설치하자.");
        return;
      }
      // camp_spot 위에 설치하면 camp_spot은 대체된다
      if (existing && existing.type === "camp_spot") {
        map.removeEntity(existing.id);
      }

      const placedType =
        def.placeable === "bonfire" ? "bonfire_placed" :
        def.placeable === "tent" ? "tent_placed" :
        def.placeable === "signal_fire" ? "signal_fire_unlit" :
        def.placeable === "raft" ? "raft_placed" :
        "planted_seed";
      let maxId = 0;
      for (const e of map.entities) if (e.id > maxId) maxId = e.id;
      const meta = def.placeable === "seed" ? { plantedDay: store.time.day } : undefined;
      map.entities.push({ id: maxId + 1, type: placedType, tx, ty, meta });
      store.inv.remove(id, 1);

      if (def.placeable === "bonfire") {
        store.flags.hasBonfire = true;
        store.pushLog("🔥 이 자리에 모닥불을 피웠다! 주변 2칸 이내에서 요리가 가능하다.");
      } else if (def.placeable === "tent") {
        store.flags.hasTent = true;
        store.pushLog("⛺ 이 자리에 천막을 세웠다! 주변 2칸 이내는 밤에도 밝고 몹이 접근하지 않는다.");
      } else if (def.placeable === "signal_fire") {
        store.pushLog("🗼 봉화대를 세웠다. 횃불(🔥)이 있을 때 탭하면 점화할 수 있다.");
      } else if (def.placeable === "raft") {
        store.pushLog("⛵ 뗏목을 해변에 띄웠다. 정화수 5개 + 조리된 음식 8개를 가지고 탭하면 탈출한다.");
      } else {
        store.pushLog("🌱 씨앗을 심었다. 2일 뒤 자라면 수확할 수 있다.");
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
    if (this.container) {
      const h = (this.container as any)._wheelHandler;
      if (h) this.scene.input.off("wheel", h);
    }
    this.container?.destroy();
    this.container = undefined;
    this.selectedSlotIdx = null;
    this.detailContainer = undefined;
    this.gridContainer = undefined;
    this.gridScrollY = 0;
    // HUDScene을 다시 최상단으로 (Day/시계/스탯 바가 항상 보이도록)
    this.scene.scene.bringToTop("HUDScene");
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
