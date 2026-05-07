import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import { drawPanel } from "./Panel";
import { makeButton, type ButtonNode } from "./Button";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";
import type { Recipe } from "../types";

export class CraftingPanel {
  private container?: Phaser.GameObjects.Container;
  private selected: Recipe | null = null;
  private detailSlot?: Phaser.GameObjects.Container;
  private listSlot?: Phaser.GameObjects.Container;
  private panelX = 0;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;
  private listScrollY = 0;
  private listMaxScroll = 0;

  constructor(private scene: Phaser.Scene) {}

  open(): void {
    if (this.container) this.close();
    this.scene.scene.bringToTop();
    getStore(this.scene).panelOpenCount++;
    const w = 920;
    const h = 600;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    this.panelX = x;
    this.panelY = y;
    this.panelW = w;
    this.panelH = h;

    const c = this.scene.add.container(0, 0).setDepth(200);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0);
    overlay.setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });
    const title = this.scene.add.text(x + 24, y + 20, "🔨 제작", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "26px",
      color: "#eaf0ff",
    });
    const hint = this.scene.add.text(x + 24, y + 56, "레시피를 클릭해 필요 재료와 제작 버튼을 확인한다.", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#8d9bd1",
    });

    // 좌/우 구역 분리선
    const listW = 560;
    const dividerX = x + 24 + listW + 12;
    const divider = this.scene.add.rectangle(dividerX, y + 92, 2, h - 120, COLORS.panelBorder, 0.7).setOrigin(0, 0);

    c.add([overlay, panel, title, hint, divider]);

    // 목록 슬롯 컨테이너 + 스크롤 마스크
    const listSlot = this.scene.add.container(0, 0);
    c.add(listSlot);
    this.listSlot = listSlot;

    // 목록 영역: 좌측 너비 560, 상단 y+92, 하단은 패널 끝 - 60(여백)
    const listAreaTop = y + 96;
    const listAreaH = h - (listAreaTop - y) - 30;
    const listMask = this.scene.make.graphics({ x: 0, y: 0 });
    listMask.fillStyle(0xffffff);
    listMask.fillRect(x + 16, listAreaTop, 580, listAreaH);
    listSlot.setMask(listMask.createGeometryMask());

    this.listScrollY = 0;
    this.renderList();

    // 휠 스크롤 핸들러 (목록 영역에서만 동작)
    const wheelHandler = (_p: unknown, _gs: unknown, _dx: number, dy: number) => {
      if (this.listMaxScroll <= 0) return;
      this.listScrollY = Phaser.Math.Clamp(this.listScrollY + dy * 0.4, 0, this.listMaxScroll);
      listSlot.setY(-this.listScrollY);
    };
    this.scene.input.on("wheel", wheelHandler);
    (c as any)._wheelHandler = wheelHandler;

    // 디테일 슬롯 컨테이너
    const detailSlot = this.scene.add.container(0, 0);
    c.add(detailSlot);
    this.detailSlot = detailSlot;
    this.renderDetail();

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

  private renderList(): void {
    const slot = this.listSlot!;
    slot.removeAll(true);
    const store = getStore(this.scene);
    const recipes = store.crafting.listRecipes();
    const x = this.panelX;
    const y = this.panelY;

    const cols = 4;
    const cardW = 128;
    const cardH = 88;
    const gap = 10;
    const startX = x + 24;
    const startY = y + 100;

    recipes.forEach((recipe, idx) => {
      const cx = startX + (idx % cols) * (cardW + gap);
      const cy = startY + Math.floor(idx / cols) * (cardH + gap);
      const can = store.crafting.canCraft(recipe);
      const isSelected = this.selected?.id === recipe.id;

      const borderCol = isSelected ? COLORS.accent : (can.ok ? 0x6aa0ff : COLORS.panelBorder);
      const fillCol = isSelected ? 0x1c2a5c : 0x101a38;
      const bg = this.scene.add
        .rectangle(cx, cy, cardW, cardH, fillCol, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(isSelected ? 3 : 2, borderCol);
      const icon = this.scene.add.text(cx + cardW / 2, cy + 22, recipe.icon, { fontSize: "32px" }).setOrigin(0.5);
      const name = this.scene.add
        .text(cx + cardW / 2, cy + cardH - 20, recipe.name, {
          fontFamily: "Galmuri11, monospace",
          fontSize: "13px",
          color: can.ok ? "#eaf0ff" : "#7a8bc4",
        })
        .setOrigin(0.5);

      // 제작 가능 뱃지
      if (can.ok) {
        const dot = this.scene.add.circle(cx + cardW - 10, cy + 10, 5, COLORS.good, 1);
        slot.add(dot);
      }

      slot.add([bg, icon, name]);

      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => {
        if (!isSelected) bg.setFillStyle(0x172447);
      });
      bg.on("pointerout", () => {
        if (!isSelected) bg.setFillStyle(fillCol);
      });
      bg.on("pointerdown", () => {
        this.selected = recipe;
        audio.play("click");
        this.renderList();
        this.renderDetail();
      });
    });

    // 스크롤 범위 계산 + 위치 보존 (위 forEach의 cardH/gap과 동일)
    const totalRows = Math.ceil(recipes.length / 4);
    const totalH = totalRows * 88 + (totalRows - 1) * 10;
    const listAreaTop = this.panelY + 96;
    const listAreaH = this.panelH - (listAreaTop - this.panelY) - 30;
    this.listMaxScroll = Math.max(0, totalH - listAreaH);
    if (this.listScrollY > this.listMaxScroll) this.listScrollY = this.listMaxScroll;
    slot.setY(-this.listScrollY);

    // 세계 카메라 무시
    const worldCam = this.scene.cameras.main;
    if (worldCam && this.container) worldCam.ignore(slot);
  }

  private renderDetail(): void {
    const slot = this.detailSlot!;
    slot.removeAll(true);

    const store = getStore(this.scene);
    const x = this.panelX;
    const y = this.panelY;
    const dx = x + 24 + 560 + 24; // 좌측 목록 + 구분선 + 여백
    const dy = y + 100;
    const dw = this.panelW - (dx - x) - 24;

    if (!this.selected) {
      const hintIcon = this.scene.add.text(dx + dw / 2, dy + 120, "👈", { fontSize: "48px" }).setOrigin(0.5);
      const hintText = this.scene.add
        .text(dx + dw / 2, dy + 190, "레시피를 선택하세요", {
          fontFamily: "Galmuri11, monospace",
          fontSize: "14px",
          color: "#8d9bd1",
        })
        .setOrigin(0.5);
      slot.add([hintIcon, hintText]);
      const worldCam = this.scene.cameras.main;
      if (worldCam && this.container) worldCam.ignore(slot);
      return;
    }

    const recipe = this.selected;
    const can = store.crafting.canCraft(recipe);

    // 큰 아이콘
    const bigIcon = this.scene.add.text(dx + dw / 2, dy + 36, recipe.icon, { fontSize: "56px" }).setOrigin(0.5);
    // 이름
    const nm = this.scene.add
      .text(dx + dw / 2, dy + 88, recipe.name, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "20px",
        color: "#eaf0ff",
      })
      .setOrigin(0.5);
    // 결과 아이템 설명
    const resultDef = ITEMS[recipe.result.id];
    const resultDesc = this.scene.add
      .text(dx + dw / 2, dy + 114, resultDef.desc, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "12px",
        color: "#a3b4e8",
        align: "center",
        wordWrap: { width: dw - 20 },
      })
      .setOrigin(0.5, 0);
    slot.add([bigIcon, nm, resultDesc]);

    // 구분선
    const sep1 = this.scene.add.rectangle(dx + 10, dy + 160, dw - 20, 1, COLORS.panelBorder, 0.5).setOrigin(0, 0);
    slot.add(sep1);

    // 재료 리스트
    const ingHeader = this.scene.add.text(dx + 12, dy + 170, "필요 재료", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#ffd97a",
    });
    slot.add(ingHeader);

    recipe.inputs.forEach((input, i) => {
      const def = ITEMS[input.id];
      const have = store.inv.count(input.id);
      const ok = have >= input.count;
      const row = dy + 196 + i * 26;
      const ic = this.scene.add.text(dx + 14, row, def.icon, { fontSize: "20px" }).setOrigin(0, 0.5);
      const tx = this.scene.add.text(dx + 44, row, def.name, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "14px",
        color: ok ? "#eaf0ff" : "#ff9a9a",
      }).setOrigin(0, 0.5);
      const cnt = this.scene.add.text(dx + dw - 14, row, `${have}/${input.count}`, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "14px",
        color: ok ? "#8be58b" : "#ff9a9a",
      }).setOrigin(1, 0.5);
      slot.add([ic, tx, cnt]);
    });

    // 요구 시설
    let reqY = dy + 196 + recipe.inputs.length * 26 + 8;
    if (recipe.requires?.length) {
      for (const r of recipe.requires) {
        const icon = r === "bonfire" ? "🏕" : "⛺";
        const name = r === "bonfire" ? "모닥불" : "천막";
        const has = r === "bonfire"
          ? store.isNearStructure("bonfire_placed", store.playerTx, store.playerTy)
          : store.isNearStructure("tent_placed", store.playerTx, store.playerTy);
        const t = this.scene.add.text(dx + 14, reqY, `${icon} 시설(2칸 이내): ${name}`, {
          fontFamily: "Galmuri11, monospace",
          fontSize: "12px",
          color: has ? "#8be58b" : "#ff9a9a",
        });
        const status = this.scene.add.text(dx + dw - 14, reqY, has ? "✓ 있음" : "✗ 없음", {
          fontFamily: "Galmuri11, monospace",
          fontSize: "12px",
          color: has ? "#8be58b" : "#ff9a9a",
        }).setOrigin(1, 0);
        slot.add([t, status]);
        reqY += 20;
      }
    }

    // 제작 버튼
    const btnY = this.panelY + this.panelH - 60;
    const btn = makeButton(this.scene, dx + dw / 2, btnY, {
      label: can.ok ? "🔨 제작하기" : `✕ ${can.reason ?? "제작 불가"}`,
      width: dw - 24,
      height: 52,
      fontSize: 17,
      bg: can.ok ? 0x1e4a2a : 0x2a0f18,
      hover: can.ok ? 0x2a6a3a : 0x3a1520,
      border: can.ok ? COLORS.good : 0x8a2230,
      textColor: can.ok ? "#eaffdc" : "#ff9a9a",
      onClick: () => this.doCraft(),
      disabled: !can.ok,
    });
    slot.add(btn as ButtonNode);

    const worldCam = this.scene.cameras.main;
    if (worldCam && this.container) worldCam.ignore(slot);
  }

  private doCraft(): void {
    if (!this.selected) return;
    const store = getStore(this.scene);
    const recipe = this.selected;
    const can = store.crafting.canCraft(recipe);
    if (!can.ok) {
      store.pushLog("제작 조건이 부족하다.");
      audio.play("error");
      return;
    }
    if (store.crafting.craft(recipe)) {
      store.pushLog(`🔨 ${recipe.name}을(를) 제작했다.`);
      audio.play("craft");
      // achievement triggers
      if (recipe.id === "bonfire") store.unlockAchievement("first_fire");
      if (recipe.id === "meat_stew") store.unlockAchievement("master_chef");
      // discover recipes from the crafted result item
      store.discoverRecipes(recipe.result.id);
      // 선택 유지하고 재렌더 (연속 제작 편의)
      this.renderList();
      this.renderDetail();
    }
  }

  close(): void {
    if (this.container) {
      const h = (this.container as any)._wheelHandler;
      if (h) this.scene.input.off("wheel", h);
    }
    this.container?.destroy();
    this.container = undefined;
    this.selected = null;
    this.listSlot = undefined;
    this.detailSlot = undefined;
    this.listScrollY = 0;
    this.listMaxScroll = 0;
    getStore(this.scene).panelOpenCount = Math.max(0, getStore(this.scene).panelOpenCount - 1);
    this.scene.scene.bringToTop("HUDScene");
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
